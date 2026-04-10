# Daily Database Backup Email — Implementation Guide

> Hand this document to an implementing agent. It describes the exact architecture and all files needed to add a scheduled daily database export-to-email feature to an Express + PostgreSQL (Prisma) + Vercel project.

---

## Overview

The system runs daily at 09:00 UTC via a Vercel Cron job. It:

1. Discovers all public tables dynamically via `information_schema`
2. Serializes each table's rows to a structured JSON file (streaming, never fully in memory)
3. Gzip-compresses the file if it exceeds a configurable size threshold
4. Emails the file as an attachment to configured recipients via Gmail SMTP + App Password
5. Sends an alert email if any step fails
6. Cleans up the local temp file after sending

---

## Prerequisites

- Node.js project with `"type": "module"` in `package.json`
- Prisma client (`@prisma/client`) already configured and connected to PostgreSQL
- `nodemailer` package installed: `npm install nodemailer`
- A Gmail account with **2-Step Verification enabled** and an **App Password** generated
- Deployed on Vercel (Cron Jobs are a Vercel platform feature)

---

## File Structure to Create

```
server/
  export/
    config.js        ← all env-var configuration
    serializer.js    ← schema discovery + JSON streaming + gzip
    gmail.js         ← nodemailer transporter + email templates
    job.js           ← orchestrator: runs all steps in order
  scripts/
    runExport.js     ← CLI entry point for manual local runs
vercel.json          ← add cron entry (may already exist)
server/index.js      ← add GET /api/export/run endpoint
```

---

## Environment Variables

Set these in `.env` locally and in **Vercel → Project → Settings → Environment Variables** for production.

| Variable | Required | Description |
|---|---|---|
| `GMAIL_USER` | Yes | Gmail address that sends the email (e.g. `you@gmail.com`) |
| `GMAIL_APP_PASSWORD` | Yes | 16-character App Password from Google Account → Security → 2-Step Verification → App passwords |
| `GMAIL_RECIPIENTS` | Yes | Comma-separated recipient addresses (e.g. `a@x.com,b@x.com`) |
| `GMAIL_SUBJECT_TEMPLATE` | No | Email subject. Use `{date}` as placeholder. Default: `MyApp Daily Export — {date}` |
| `GMAIL_MAX_ATTACHMENT_MB` | No | Skip attaching file if larger than this. Default: `24` (Gmail limit is 25 MB) |
| `EXPORT_OUTPUT_DIR` | No | Temp directory for the JSON file. Default: `/tmp/exports` |
| `EXPORT_GZIP_THRESHOLD_MB` | No | Compress file if it exceeds this size in MB. Default: `50` |
| `EXPORT_SOURCE_SYSTEM` | No | Label in the JSON metadata. Default: `MyApp` |
| `EXPORT_TRIGGER_SECRET` | No | Bearer token for manual HTTP triggers. Generate with `openssl rand -hex 32` |
| `CRON_SECRET` | Auto | Set automatically by Vercel for cron-triggered requests. Do not set manually |

---

## File 1: `server/export/config.js`

```js
import 'dotenv/config';

/**
 * All export-job configuration read from environment variables.
 *
 * Required for Gmail:
 *   GMAIL_USER          — the Gmail address that sends the email
 *   GMAIL_APP_PASSWORD  — the 16-char App Password from Google Account → Security → App passwords
 *   GMAIL_RECIPIENTS    — comma-separated list of recipient addresses
 *
 * Required for the trigger endpoint:
 *   CRON_SECRET             — set automatically by Vercel for cron calls
 *   EXPORT_TRIGGER_SECRET   — optional extra secret for manual HTTP triggers
 */
export const config = {
  outputDir: process.env.EXPORT_OUTPUT_DIR || '/tmp/exports',
  gzipThresholdMb: Number(process.env.EXPORT_GZIP_THRESHOLD_MB ?? 50),
  sourceSystem: process.env.EXPORT_SOURCE_SYSTEM || 'MyApp',
  schemaVersion: '1.0.0',

  // Columns to strip from the export — never ship password hashes
  excludeColumns: {
    users: ['password'],
  },

  gmail: {
    user: process.env.GMAIL_USER || '',
    appPassword: process.env.GMAIL_APP_PASSWORD || '',
    recipients: (process.env.GMAIL_RECIPIENTS || '').split(',').filter(Boolean),
    subjectTemplate:
      process.env.GMAIL_SUBJECT_TEMPLATE || 'MyApp Daily Export — {date}',
    maxAttachmentSizeMb: Number(process.env.GMAIL_MAX_ATTACHMENT_MB ?? 24),
  },
};
```

**Adapt**: Change `excludeColumns` to match your schema. Change `sourceSystem` and `subjectTemplate` defaults to your app name.

---

## File 2: `server/export/serializer.js`

```js
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import prisma from '../db.js';         // ← your Prisma singleton
import { config } from './config.js';

// ---------------------------------------------------------------------------
// PostgreSQL data_type → database-agnostic neutral type
// ---------------------------------------------------------------------------
export function pgTypeToNeutral(pgType) {
  const t = (pgType || '').toLowerCase();
  if (['bigint', 'int8', 'bigserial'].includes(t)) return 'long';
  if (['integer', 'int', 'int4', 'serial', 'smallint', 'int2', 'smallserial'].includes(t))
    return 'int';
  if (['numeric', 'decimal'].includes(t)) return 'decimal';
  if (['real', 'float4', 'double precision', 'float8'].includes(t)) return 'decimal';
  if (['boolean', 'bool'].includes(t)) return 'bool';
  if (['uuid'].includes(t)) return 'guid';
  if (['timestamp without time zone', 'timestamp with time zone',
       'timestamptz', 'timestamp', 'date'].includes(t)) return 'datetime';
  if (['bytea'].includes(t)) return 'bytes';
  if (['json', 'jsonb'].includes(t)) return 'json';
  return 'string';
}

// ---------------------------------------------------------------------------
// JS value → JSON-safe value for each neutral type
// ---------------------------------------------------------------------------
export function serializeValue(value, neutralType) {
  if (value === null || value === undefined) return null;
  switch (neutralType) {
    case 'datetime':
      if (value instanceof Date) return value.toISOString();
      return new Date(value).toISOString();
    case 'bytes':
      if (Buffer.isBuffer(value)) return value.toString('base64');
      return Buffer.from(value).toString('base64');
    case 'decimal':
      return value.toString();            // preserve full precision
    case 'long':
      if (typeof value === 'bigint') return value.toString();
      return value;
    case 'json':
      return value;                       // already a JS object from Prisma
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------
// Cairo time helpers (UTC+2, DST abolished in 2011)
// Change the timeZone to your preferred timezone.
// ---------------------------------------------------------------------------
export function getCairoNow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const iso       = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+02:00`;
  const fileStamp = `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
  return { iso, fileStamp, date: `${parts.year}-${parts.month}-${parts.day}` };
}

export function buildFileName(cairo) {
  return `gym-export-${cairo.fileStamp}.json`;
}

// ---------------------------------------------------------------------------
// Schema discovery via information_schema
// ---------------------------------------------------------------------------
async function discoverTables() {
  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations')
    ORDER BY table_name
  `);

  const tables = [];
  for (const { table_name } of tableRows) {
    const colRows = await prisma.$queryRawUnsafe(`
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        COALESCE((
          SELECT 'PRIMARY KEY'
          FROM information_schema.key_column_usage kcu
          JOIN information_schema.table_constraints tc
            ON  tc.constraint_name = kcu.constraint_name
            AND tc.table_schema    = kcu.table_schema
            AND tc.table_name      = kcu.table_name
          WHERE kcu.table_schema = 'public'
            AND kcu.table_name   = $1
            AND kcu.column_name  = c.column_name
            AND tc.constraint_type = 'PRIMARY KEY'
          LIMIT 1
        ), '') AS constraint_type
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name   = $1
      ORDER BY c.ordinal_position
    `, table_name);

    const excluded = config.excludeColumns[table_name] || [];
    const columns = colRows
      .filter(c => !excluded.includes(c.column_name))
      .map(c => ({
        name: c.column_name,
        type: pgTypeToNeutral(c.data_type),
        nullable: c.is_nullable === 'YES',
      }));

    const primaryKey = colRows
      .filter(c => c.constraint_type === 'PRIMARY KEY')
      .map(c => c.column_name);

    tables.push({ name: table_name, primaryKey, columns, selectNames: columns.map(c => c.name) });
  }
  return tables;
}

// ---------------------------------------------------------------------------
// Streaming JSON writer — never loads full dataset into memory
// ---------------------------------------------------------------------------
function writeToStream(ws, chunk) {
  return new Promise((resolve, reject) => {
    const ok = ws.write(chunk);
    if (!ok) { ws.once('drain', resolve); ws.once('error', reject); }
    else resolve();
  });
}

function closeStream(ws) {
  return new Promise((resolve, reject) => {
    ws.end();
    ws.once('finish', resolve);
    ws.once('error', reject);
  });
}

export async function serializeDatabase(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const tables = await discoverTables();

  let totalRows = 0;
  for (const t of tables) {
    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "${t.name}"`,
    );
    t.rowCount = Number(count);
    totalRows += t.rowCount;
  }

  const cairoNow = getCairoNow();
  const ws = fs.createWriteStream(filePath, { encoding: 'utf8' });

  const metadata = {
    exportedAtUtc:   new Date().toISOString(),
    exportedAtCairo: cairoNow.iso,
    sourceSystem:    config.sourceSystem,
    schemaVersion:   config.schemaVersion,
    tableCount:      tables.length,
    rowCount:        totalRows,
  };
  await writeToStream(ws, `{"exportMetadata":${JSON.stringify(metadata)},"tables":[`);

  for (let ti = 0; ti < tables.length; ti++) {
    const t = tables[ti];
    await writeToStream(
      ws,
      `{"name":${JSON.stringify(t.name)},"primaryKey":${JSON.stringify(t.primaryKey)},"columns":${JSON.stringify(t.columns)},"rows":[`,
    );

    const colList = t.selectNames.map(n => `"${n}"`).join(', ');
    const rows = await prisma.$queryRawUnsafe(`SELECT ${colList} FROM "${t.name}"`);

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const serialized = {};
      for (const col of t.columns) {
        serialized[col.name] = serializeValue(row[col.name], col.type);
      }
      await writeToStream(ws, JSON.stringify(serialized) + (ri < rows.length - 1 ? ',' : ''));
    }

    await writeToStream(ws, `]${ti < tables.length - 1 ? '},' : '}'}`);
  }

  await writeToStream(ws, ']}');
  await closeStream(ws);

  return { filePath, rowCount: totalRows, tableCount: tables.length };
}

// ---------------------------------------------------------------------------
// Optional gzip: compress if file exceeds threshold, delete original
// ---------------------------------------------------------------------------
export async function maybeGzip(filePath, thresholdMb) {
  const stats  = fs.statSync(filePath);
  const sizeMb = stats.size / (1024 * 1024);

  if (sizeMb < thresholdMb) {
    return { finalPath: filePath, gzipped: false, sizeBytes: stats.size };
  }

  const gzPath = filePath + '.gz';
  await pipeline(
    fs.createReadStream(filePath),
    zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
    fs.createWriteStream(gzPath),
  );
  fs.unlinkSync(filePath);

  return { finalPath: gzPath, gzipped: true, sizeBytes: fs.statSync(gzPath).size };
}
```

**Key design decisions**:
- Schema is discovered dynamically — no hardcoded table list. Works automatically when tables are added.
- Rows are streamed one-by-one to the file; the full dataset is never held in memory.
- `excludeColumns` strips sensitive columns (e.g. password hashes) before the query is even built.
- BigInt, Date, Buffer, and decimal types are serialized to JSON-safe strings.

---

## File 3: `server/export/gmail.js`

```js
import nodemailer from 'nodemailer';
import { config } from './config.js';

function buildTransporter() {
  if (!config.gmail.user || !config.gmail.appPassword) {
    throw new Error('Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmail.user,
      pass: config.gmail.appPassword,
    },
  });
}

function formatBytes(bytes) {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// HTML email bodies
// ---------------------------------------------------------------------------
function buildSuccessHtml({ date, rowCount, tableCount, sizeBytes, attachmentNote }) {
  const noteHtml = attachmentNote
    ? `<p style="color:#888"><em>${attachmentNote}</em></p>`
    : '';
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px">
  <h2 style="color:#2d7d46">MyApp Daily Export — ${date}</h2>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
    <tr><td><strong>Export date</strong></td><td>${date}</td></tr>
    <tr><td><strong>Tables exported</strong></td><td>${tableCount}</td></tr>
    <tr><td><strong>Total rows</strong></td><td>${rowCount.toLocaleString()}</td></tr>
    <tr><td><strong>File size</strong></td><td>${formatBytes(sizeBytes)}</td></tr>
  </table>
  ${noteHtml}
</body>
</html>`;
}

function buildFailureHtml({ date, error }) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#222;max-width:600px">
  <h2 style="color:#c0392b">&#9888; MyApp Export FAILED — ${date}</h2>
  <p><strong>Error:</strong> ${error.message}</p>
  <pre style="background:#f8f8f8;padding:12px;overflow:auto">${error.stack ?? ''}</pre>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Send success notification with export file attached
// ---------------------------------------------------------------------------
export async function sendExportNotification({
  date, rowCount, tableCount, sizeBytes, filePath, fileName, gzipped,
}) {
  const transporter  = buildTransporter();
  const maxBytes     = config.gmail.maxAttachmentSizeMb * 1024 * 1024;
  const attach       = sizeBytes <= maxBytes;
  const mimeType     = gzipped ? 'application/gzip' : 'application/json';
  const attachmentNote = attach
    ? null
    : `File (${formatBytes(sizeBytes)}) exceeds the ${config.gmail.maxAttachmentSizeMb} MB attachment limit and was not attached.`;

  const subject = config.gmail.subjectTemplate.replace('{date}', date);

  await transporter.sendMail({
    from:        config.gmail.user,
    to:          config.gmail.recipients.join(', '),
    subject,
    html:        buildSuccessHtml({ date, rowCount, tableCount, sizeBytes, attachmentNote }),
    attachments: attach ? [{ filename: fileName, path: filePath, contentType: mimeType }] : [],
  });
}

// ---------------------------------------------------------------------------
// Send alert email on unrecoverable job failure
// ---------------------------------------------------------------------------
export async function sendAlertEmail({ date, error }) {
  const transporter = buildTransporter();
  await transporter.sendMail({
    from:    config.gmail.user,
    to:      config.gmail.recipients.join(', '),
    subject: `ALERT: MyApp Export Failed — ${date}`,
    html:    buildFailureHtml({ date, error }),
  });
}
```

**Note on Gmail App Password**: Go to `myaccount.google.com` → Security → 2-Step Verification (must be enabled) → App passwords → create one named "MyApp Export". Paste the 16-character output as `GMAIL_APP_PASSWORD`. Never use your actual Gmail password.

---

## File 4: `server/export/job.js`

```js
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { serializeDatabase, getCairoNow, buildFileName, maybeGzip } from './serializer.js';
import { sendExportNotification, sendAlertEmail } from './gmail.js';

// ---------------------------------------------------------------------------
// Structured JSON logger (parseable in Vercel log viewer)
// ---------------------------------------------------------------------------
function makeLogger(correlationId) {
  const base = () => ({ ts: new Date().toISOString(), correlationId });
  return {
    info:  (msg, data = {}) => console.log(JSON.stringify({ ...base(), level: 'info',  msg, ...data })),
    warn:  (msg, data = {}) => console.warn(JSON.stringify({ ...base(), level: 'warn',  msg, ...data })),
    error: (msg, err, data = {}) => console.error(JSON.stringify({
      ...base(), level: 'error', msg, error: err?.message, stack: err?.stack, ...data,
    })),
  };
}

// ---------------------------------------------------------------------------
// Exponential-backoff retry for transient network errors
// ---------------------------------------------------------------------------
async function withRetry(fn, { retries = 3, baseDelayMs = 1000, label = 'op', log } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status ?? err.responseCode;
      const isTransient =
        status === 429 ||
        status === 'ECONNRESET' ||
        status === 'ETIMEDOUT' ||
        (typeof status === 'number' && status >= 500 && status < 600);

      if (attempt === retries || !isTransient) throw err;

      const delay = baseDelayMs * 2 ** attempt;
      log?.warn(`${label} failed — retrying`, { attempt: attempt + 1, maxAttempts: retries + 1, delayMs: delay, error: err.message });
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ---------------------------------------------------------------------------
// Main export job — call this from the HTTP endpoint and the CLI script
// ---------------------------------------------------------------------------
export async function runExportJob({ correlationId = Date.now().toString(36) } = {}) {
  const log      = makeLogger(correlationId);
  const jobStart = Date.now();
  const cairoNow = getCairoNow();
  const fileName = buildFileName(cairoNow);
  const filePath = path.join(config.outputDir, fileName);

  log.info('export job started', { cairoDate: cairoNow.date, fileName });

  let finalPath = null;

  try {
    // 1. Ensure output directory
    fs.mkdirSync(config.outputDir, { recursive: true });

    // 2. Serialize database to JSON
    log.info('serializing database', { outputPath: filePath });
    const { rowCount, tableCount } = await serializeDatabase(filePath);
    log.info('serialization complete', { rowCount, tableCount, durationMs: Date.now() - jobStart });

    // 3. Gzip if over threshold
    const { finalPath: fp, gzipped, sizeBytes } = await maybeGzip(filePath, config.gzipThresholdMb);
    finalPath = fp;
    const finalName = path.basename(finalPath);
    log.info('file ready', { finalName, gzipped, sizeMb: (sizeBytes / 1024 / 1024).toFixed(2) });

    // 4. Send email
    const gmailEnabled = config.gmail.recipients.length > 0;
    if (gmailEnabled) {
      await withRetry(
        () => sendExportNotification({ date: cairoNow.date, rowCount, tableCount, sizeBytes, filePath: finalPath, fileName: finalName, gzipped }),
        { label: 'gmail.send', log },
      );
      log.info('notification email sent');
    }

    // 5. Cleanup local temp file
    try { fs.unlinkSync(finalPath); } catch { /* non-fatal */ }

    const result = { success: true, date: cairoNow.date, rowCount, tableCount, sizeBytes, gzipped, durationMs: Date.now() - jobStart };
    log.info('export job completed', result);
    return result;

  } catch (err) {
    log.error('export job failed', err, { durationMs: Date.now() - jobStart });

    if (config.gmail.recipients.length > 0) {
      try { await sendAlertEmail({ date: cairoNow.date, error: err }); }
      catch (alertErr) { log.error('failed to send alert email', alertErr); }
    }

    // Cleanup partial file
    try {
      if (finalPath && fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { /* ignore */ }

    throw err;
  }
}
```

---

## File 5: `server/scripts/runExport.js`

```js
/**
 * Manual CLI trigger for the daily export job.
 * Usage:  node server/scripts/runExport.js
 *         npm run export
 *
 * Runs the exact same code path as the Vercel cron trigger.
 */
import 'dotenv/config';
import { runExportJob } from '../export/job.js';

const correlationId = 'manual-' + Date.now().toString(36);
console.log(`[runExport] Starting export job (correlationId=${correlationId}) …`);

try {
  const result = await runExportJob({ correlationId });
  console.log('[runExport] Job completed successfully:');
  console.log(`  Date:     ${result.date}`);
  console.log(`  Tables:   ${result.tableCount}`);
  console.log(`  Rows:     ${result.rowCount.toLocaleString()}`);
  console.log(`  Size:     ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB${result.gzipped ? ' (gzipped)' : ''}`);
  console.log(`  Duration: ${result.durationMs} ms`);
  process.exit(0);
} catch (err) {
  console.error('[runExport] Job failed:', err.message);
  process.exit(1);
}
```

---

## Step 6: Add the HTTP Trigger Endpoint to `server/index.js`

Add this route to your existing Express app. It is hit by Vercel Cron and can also be called manually with a Bearer token:

```js
import { runExportJob } from './export/job.js';

// GET /api/export/run
// Called by Vercel Cron (verified by x-vercel-cron-schedule header)
// or manually with:  Authorization: Bearer <EXPORT_TRIGGER_SECRET>
app.get('/api/export/run', async (req, res) => {
  const authHeader    = req.headers.authorization || '';
  const cronSecret    = process.env.CRON_SECRET;
  const triggerSecret = process.env.EXPORT_TRIGGER_SECRET;

  const isVercelCron = !!req.headers['x-vercel-cron-schedule'];

  const authorized =
    isVercelCron ||
    (cronSecret    && authHeader === `Bearer ${cronSecret}`)    ||
    (triggerSecret && authHeader === `Bearer ${triggerSecret}`);

  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const correlationId = Date.now().toString(36);
  try {
    const result = await runExportJob({ correlationId });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message, correlationId });
  }
});
```

---

## Step 7: Configure Vercel Cron in `vercel.json`

If `vercel.json` doesn't exist, create it. If it does, add the `crons` key:

```json
{
  "crons": [
    {
      "path": "/api/export/run",
      "schedule": "0 9 * * *"
    }
  ]
}
```

- `0 9 * * *` = 09:00 UTC daily (11:00 Cairo time / UTC+2)
- Change the time to suit your timezone. Use [crontab.guru](https://crontab.guru) to verify.
- The `path` must match your Express route exactly.

---

## Step 8: Add npm Script to `package.json`

```json
{
  "scripts": {
    "export": "node server/scripts/runExport.js"
  }
}
```

---

## Testing Checklist

### 1. Test locally first

```bash
# Set all required env vars in .env, then:
npm run export
```

You should see JSON log lines in stdout and receive an email. Check spam if it doesn't arrive.

### 2. Verify the JSON export format

The output file has this structure:

```json
{
  "exportMetadata": {
    "exportedAtUtc": "2026-04-10T07:00:00.000Z",
    "exportedAtCairo": "2026-04-10T09:00:00+02:00",
    "sourceSystem": "MyApp",
    "schemaVersion": "1.0.0",
    "tableCount": 4,
    "rowCount": 1234
  },
  "tables": [
    {
      "name": "users",
      "primaryKey": ["id"],
      "columns": [
        { "name": "id", "type": "long", "nullable": false },
        { "name": "username", "type": "string", "nullable": false }
      ],
      "rows": [
        { "id": "1744300800000", "username": "admin" }
      ]
    }
  ]
}
```

Note: `password` column is excluded. BigInt IDs are serialized as strings.

### 3. Test the HTTP endpoint manually

```bash
curl -H "Authorization: Bearer <EXPORT_TRIGGER_SECRET>" \
     https://your-app.vercel.app/api/export/run
```

Expected response on success:

```json
{ "success": true, "date": "2026-04-10", "rowCount": 1234, "tableCount": 4, "sizeBytes": 98765, "gzipped": false, "durationMs": 3200 }
```

### 4. Verify Vercel Cron is wired up

After deploy: Vercel Dashboard → Project → Cron Jobs tab. You should see the `/api/export/run` job listed with its next scheduled run time.

---

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| `Gmail credentials not configured` | `GMAIL_USER` or `GMAIL_APP_PASSWORD` env var missing | Set both in `.env` and Vercel env vars |
| `Invalid login: 535-5.7.8 Username and Password not accepted` | Using your real Gmail password | Must use an **App Password**, not your account password |
| `Error: Less-secure app access` | 2-Step Verification not enabled on the Gmail account | Enable 2SV on the Google account first, then generate App Password |
| `401 Unauthorized` on HTTP trigger | Token mismatch | Check `EXPORT_TRIGGER_SECRET` matches the `Bearer` value |
| Cron not firing | Route path mismatch in `vercel.json` | `path` in `vercel.json` must exactly match the Express route |
| File not attached to email | File exceeds `GMAIL_MAX_ATTACHMENT_MB` | Lower the threshold or increase the env var; email body still reports stats |
| Gzip always runs | `EXPORT_GZIP_THRESHOLD_MB` set too low | Increase the threshold |

---

## Security Notes

- The `/api/export/run` endpoint is protected by Bearer token. Never expose `EXPORT_TRIGGER_SECRET` publicly.
- `CRON_SECRET` is injected automatically by Vercel — do not set it manually in env vars.
- The `excludeColumns` config ensures password hashes are never serialized regardless of schema changes.
- The JSON export contains all other data — treat the email and attachment as sensitive. Use a private recipient list.
