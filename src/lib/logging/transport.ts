/* eslint-disable no-console -- transport failures must go to console only, never back into the log pipeline */

export type LogEntry = Record<string, unknown>;

export interface LogTransport {
  send(entries: LogEntry[]): Promise<void>;
}

const MAX_QUEUE = 1000;

/** Trace line for Vercel logs. Console only (never the logger), and never includes the token. */
function trace(msg: string, ctx: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: 'info', msg: `[axiom] ${msg}`, ts: new Date().toISOString(), ...ctx }));
}
let reportedDisabled = false;
const FLUSH_AT = 50;

export class AxiomTransport implements LogTransport {
  constructor(
    private readonly token: string,
    private readonly dataset: string,
    private readonly baseUrl: string,
  ) {}

  async send(entries: LogEntry[]): Promise<void> {
    // Edge endpoints (e.g. eu-central-1.aws.edge.axiom.co) use /v1/ingest/{dataset};
    // the classic api.axiom.co host uses /v1/datasets/{dataset}/ingest.
    const dataset = encodeURIComponent(this.dataset);
    const path = this.baseUrl.includes('.edge.axiom.co') ? `/v1/ingest/${dataset}` : `/v1/datasets/${dataset}/ingest`;
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(entries),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Axiom ingest failed with ${res.status} at ${this.baseUrl}${path}: ${detail}`);
    }
    trace('ingest ok', { status: res.status, count: entries.length, host: new URL(this.baseUrl).host, dataset: this.dataset });
  }
}

export function getTransport(): LogTransport | null {
  const token = process.env.AXIOM_TOKEN;
  if (!token) return null;
  return new AxiomTransport(
    token,
    process.env.AXIOM_DATASET || 'predictions-api',
    process.env.AXIOM_URL || 'https://api.axiom.co',
  );
}

let queue: LogEntry[] = [];

/** Queues an entry for the next flush. No-op when AXIOM_TOKEN is not set. */
export function enqueue(entry: LogEntry): void {
  if (!process.env.AXIOM_TOKEN) {
    if (!reportedDisabled) {
      reportedDisabled = true;
      trace('disabled: AXIOM_TOKEN is not set in this environment');
    }
    return;
  }
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(entry);
  if (queue.length >= FLUSH_AT) void flushLogs();
}

/** Sends everything queued so far in one batch. Never throws. */
export async function flushLogs(): Promise<void> {
  if (queue.length === 0) return;
  const transport = getTransport();
  if (!transport) { queue = []; return; }
  const batch = queue;
  queue = [];
  trace('flushing', { count: batch.length, host: process.env.AXIOM_URL || 'api.axiom.co', dataset: process.env.AXIOM_DATASET || 'predictions-api' });
  try {
    await transport.send(batch);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: '[log-transport] send failed', error: error instanceof Error ? error.message : String(error) }));
  }
}
