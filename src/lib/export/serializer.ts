import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { exportConfig } from './config';
import { SystemRepository } from '@/lib/repositories/system-repository';

// ---------------------------------------------------------------------------
// PostgreSQL data_type → database-agnostic neutral type
// ---------------------------------------------------------------------------
function pgTypeToNeutral(pgType: string): string {
  const t = (pgType || '').toLowerCase();
  if (['bigint', 'int8', 'bigserial'].includes(t)) return 'long';
  if (['integer', 'int', 'int4', 'serial', 'smallint', 'int2', 'smallserial'].includes(t))
    return 'int';
  if (['numeric', 'decimal'].includes(t)) return 'decimal';
  if (['real', 'float4', 'double precision', 'float8'].includes(t)) return 'decimal';
  if (['boolean', 'bool'].includes(t)) return 'bool';
  if (['uuid'].includes(t)) return 'guid';
  if (
    ['timestamp without time zone', 'timestamp with time zone', 'timestamptz', 'timestamp', 'date'].includes(t)
  )
    return 'datetime';
  if (['bytea'].includes(t)) return 'bytes';
  if (['json', 'jsonb'].includes(t)) return 'json';
  return 'string';
}

// ---------------------------------------------------------------------------
// JS value → JSON-safe value for each neutral type
// ---------------------------------------------------------------------------
function serializeValue(value: unknown, neutralType: string): unknown {
  if (value === null || value === undefined) return null;
  switch (neutralType) {
    case 'datetime':
      if (value instanceof Date) return value.toISOString();
      return new Date(value as string).toISOString();
    case 'bytes':
      if (Buffer.isBuffer(value)) return value.toString('base64');
      return Buffer.from(value as ArrayBuffer).toString('base64');
    case 'decimal':
      return (value as object).toString();
    case 'long':
      if (typeof value === 'bigint') return value.toString();
      return value;
    case 'json':
      return value;
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------
// CLT (UTC+2) time helpers
// ---------------------------------------------------------------------------
export function getCLTNow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
  const iso       = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+02:00`;
  const fileStamp = `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
  const date      = `${parts.year}-${parts.month}-${parts.day}`;
  return { iso, fileStamp, date };
}

export function buildFileName(clt: ReturnType<typeof getCLTNow>): string {
  return `football-predictions-export-${clt.fileStamp}.json`;
}

// ---------------------------------------------------------------------------
// Schema discovery via information_schema
// ---------------------------------------------------------------------------
interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

interface TableInfo {
  name: string;
  primaryKey: string[];
  columns: ColumnInfo[];
  selectNames: string[];
  rowCount: number;
}

async function discoverTables(): Promise<TableInfo[]> {
  const tableRows = await SystemRepository.queryRawUnsafe<{ table_name: string }[]>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type   = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations')
    ORDER BY table_name
  `);

  const tables: TableInfo[] = [];

  for (const { table_name } of tableRows) {
    const colRows = await SystemRepository.queryRawUnsafe<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      constraint_type: string;
    }[]>(`
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
          WHERE kcu.table_schema   = 'public'
            AND kcu.table_name     = $1
            AND kcu.column_name    = c.column_name
            AND tc.constraint_type = 'PRIMARY KEY'
          LIMIT 1
        ), '') AS constraint_type
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name   = $1
      ORDER BY c.ordinal_position
    `, table_name);

    const excluded = exportConfig.excludeColumns[table_name] || [];
    const columns: ColumnInfo[] = colRows
      .filter(c => !excluded.includes(c.column_name))
      .map(c => ({
        name:     c.column_name,
        type:     pgTypeToNeutral(c.data_type),
        nullable: c.is_nullable === 'YES',
      }));

    const primaryKey = colRows
      .filter(c => c.constraint_type === 'PRIMARY KEY')
      .map(c => c.column_name);

    tables.push({
      name:        table_name,
      primaryKey,
      columns,
      selectNames: columns.map(c => c.name),
      rowCount:    0,
    });
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Streaming JSON writer — never loads full dataset into memory
// ---------------------------------------------------------------------------
function writeToStream(ws: fs.WriteStream, chunk: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = ws.write(chunk);
    if (!ok) {
      ws.once('drain', resolve);
      ws.once('error', reject);
    } else {
      resolve();
    }
  });
}

function closeStream(ws: fs.WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.end();
    ws.once('finish', resolve);
    ws.once('error', reject);
  });
}

export async function serializeDatabase(filePath: string): Promise<{ rowCount: number; tableCount: number }> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const tables = await discoverTables();

  let totalRows = 0;
  for (const t of tables) {
    const rows = await SystemRepository.queryRawUnsafe<[{ count: number | bigint }]>(
      `SELECT COUNT(*)::int AS count FROM "${t.name}"`,
    );
    t.rowCount = Number(rows[0].count);
    totalRows += t.rowCount;
  }

  const cltNow = getCLTNow();
  const ws = fs.createWriteStream(filePath, { encoding: 'utf8' });

  const metadata = {
    exportedAtUtc:   new Date().toISOString(),
    exportedAtCLT:   cltNow.iso,
    sourceSystem:    exportConfig.sourceSystem,
    schemaVersion:   exportConfig.schemaVersion,
    tableCount:      tables.length,
    rowCount:        totalRows,
  };

  await writeToStream(ws, `{"exportMetadata":${JSON.stringify(metadata)},"tables":[`);

  for (let ti = 0; ti < tables.length; ti++) {
    const t = tables[ti];
    const colList = t.selectNames.map(n => `"${n}"`).join(', ');

    await writeToStream(
      ws,
      `{"name":${JSON.stringify(t.name)},"primaryKey":${JSON.stringify(t.primaryKey)},"columns":${JSON.stringify(t.columns)},"rows":[`,
    );

    const rows = await SystemRepository.queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${colList} FROM "${t.name}"`,
    );

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const serialized: Record<string, unknown> = {};
      for (const col of t.columns) {
        serialized[col.name] = serializeValue(row[col.name], col.type);
      }
      await writeToStream(ws, JSON.stringify(serialized) + (ri < rows.length - 1 ? ',' : ''));
    }

    await writeToStream(ws, `]${ti < tables.length - 1 ? '},' : '}'}`);
  }

  await writeToStream(ws, ']}');
  await closeStream(ws);

  return { rowCount: totalRows, tableCount: tables.length };
}

// ---------------------------------------------------------------------------
// Optional gzip: compress if file exceeds threshold, delete original
// ---------------------------------------------------------------------------
export async function maybeGzip(
  filePath: string,
  thresholdMb: number,
): Promise<{ finalPath: string; gzipped: boolean; sizeBytes: number }> {
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
