import fs from 'fs';
import path from 'path';
import { exportConfig } from './config';
import { serializeDatabase, getCLTNow, buildFileName, maybeGzip } from './serializer';
import { sendExportNotification, sendExportAlertEmail } from './email';

// ---------------------------------------------------------------------------
// Structured JSON logger (parseable in Vercel log viewer)
// ---------------------------------------------------------------------------
function makeLogger(correlationId: string) {
  const base = () => ({ ts: new Date().toISOString(), correlationId });
  return {
    info:  (msg: string, data: Record<string, unknown> = {}) =>
      console.log(JSON.stringify({ ...base(), level: 'info', msg, ...data })),
    warn:  (msg: string, data: Record<string, unknown> = {}) =>
      console.warn(JSON.stringify({ ...base(), level: 'warn', msg, ...data })),
    error: (msg: string, err: Error | unknown, data: Record<string, unknown> = {}) =>
      console.error(JSON.stringify({
        ...base(),
        level: 'error',
        msg,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        ...data,
      })),
  };
}

// ---------------------------------------------------------------------------
// Exponential-backoff retry for transient errors
// ---------------------------------------------------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 3,
    baseDelayMs = 1000,
    label = 'op',
    log,
  }: {
    retries?: number;
    baseDelayMs?: number;
    label?: string;
    log?: ReturnType<typeof makeLogger>;
  } = {},
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number; responseCode?: string }).status
        ?? (err as { responseCode?: string }).responseCode;
      const isTransient =
        status === 429 ||
        status === 'ECONNRESET' ||
        status === 'ETIMEDOUT' ||
        (typeof status === 'number' && status >= 500 && status < 600);

      if (attempt === retries || !isTransient) throw err;

      const delay = baseDelayMs * 2 ** attempt;
      log?.warn(`${label} failed — retrying`, {
        attempt:     attempt + 1,
        maxAttempts: retries + 1,
        delayMs:     delay,
        error:       err instanceof Error ? err.message : String(err),
      });
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

// ---------------------------------------------------------------------------
// Export result shape
// ---------------------------------------------------------------------------
export interface ExportResult {
  success: true;
  date: string;
  rowCount: number;
  tableCount: number;
  sizeBytes: number;
  gzipped: boolean;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Main export job
// ---------------------------------------------------------------------------
export async function runExportJob({
  correlationId = Date.now().toString(36),
}: { correlationId?: string } = {}): Promise<ExportResult> {
  const log      = makeLogger(correlationId);
  const jobStart = Date.now();
  const cltNow   = getCLTNow();
  const fileName = buildFileName(cltNow);
  const filePath = path.join(exportConfig.outputDir, fileName);

  log.info('export job started', { cltDate: cltNow.date, fileName });

  let finalPath: string | null = null;

  try {
    fs.mkdirSync(exportConfig.outputDir, { recursive: true });

    log.info('serializing database', { outputPath: filePath });
    const { rowCount, tableCount } = await serializeDatabase(filePath);
    log.info('serialization complete', { rowCount, tableCount, durationMs: Date.now() - jobStart });

    const { finalPath: fp, gzipped, sizeBytes } = await maybeGzip(filePath, exportConfig.gzipThresholdMb);
    finalPath = fp;
    const finalName = path.basename(finalPath);
    log.info('file ready', { finalName, gzipped, sizeMb: (sizeBytes / 1024 / 1024).toFixed(2) });

    if (exportConfig.gmail.recipients.length > 0) {
      await withRetry(
        () => sendExportNotification({
          date:      cltNow.date,
          rowCount,
          tableCount,
          sizeBytes,
          filePath:  finalPath!,
          fileName:  finalName,
          gzipped,
        }),
        { label: 'gmail.send', log },
      );
      log.info('notification email sent');
    } else {
      log.warn('no GMAIL_RECIPIENTS configured — skipping email');
    }

    try { fs.unlinkSync(finalPath); } catch { /* non-fatal */ }

    const result: ExportResult = {
      success:    true,
      date:       cltNow.date,
      rowCount,
      tableCount,
      sizeBytes,
      gzipped,
      durationMs: Date.now() - jobStart,
    };
    log.info('export job completed', result as unknown as Record<string, unknown>);
    return result;

  } catch (err) {
    log.error('export job failed', err, { durationMs: Date.now() - jobStart });

    if (exportConfig.gmail.recipients.length > 0) {
      try {
        await sendExportAlertEmail({
          date:  cltNow.date,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      } catch (alertErr) {
        log.error('failed to send alert email', alertErr);
      }
    }

    // Cleanup partial files
    try {
      if (finalPath && fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { /* ignore */ }

    throw err;
  }
}
