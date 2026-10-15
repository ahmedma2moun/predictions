/* eslint-disable no-console -- transport failures must go to console only, never back into the log pipeline */

export type LogEntry = Record<string, unknown>;

export interface LogTransport {
  send(entries: LogEntry[]): Promise<void>;
}

const MAX_QUEUE = 1000;

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
  }
}

/** AXIOM_URL may be pasted as a full ingest URL; only its origin is used. */
function axiomOrigin(url: string | undefined): string {
  if (!url) return 'https://api.axiom.co';
  try { return new URL(url).origin; } catch { return url.replace(/\/+$/, ''); }
}

export function getTransport(): LogTransport | null {
  const token = process.env.AXIOM_TOKEN;
  if (!token) return null;
  return new AxiomTransport(
    token,
    process.env.AXIOM_DATASET || 'predictions-api',
    axiomOrigin(process.env.AXIOM_URL),
  );
}

let queue: LogEntry[] = [];

/** Queues an entry for the next flush. No-op when AXIOM_TOKEN is not set. */
export function enqueue(entry: LogEntry): void {
  if (!process.env.AXIOM_TOKEN) return;
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
  try {
    await transport.send(batch);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: '[log-transport] send failed', error: error instanceof Error ? error.message : String(error) }));
  }
}
