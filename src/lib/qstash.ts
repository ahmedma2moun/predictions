import { Client, Receiver } from '@upstash/qstash';

// Module-level singletons — one per serverless cold start, same pattern as
// src/lib/football/factory.ts.

let _client: Client | null = null;

export function getQStashClient(): Client {
  if (_client) return _client;
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error('QSTASH_TOKEN environment variable is not set');
  _client = new Client({ baseUrl: process.env.QSTASH_URL, token });
  return _client;
}

let _receiver: Receiver | null = null;

export function getQStashReceiver(): Receiver {
  if (_receiver) return _receiver;
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    throw new Error('QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY environment variables are not set');
  }
  _receiver = new Receiver({ currentSigningKey, nextSigningKey });
  return _receiver;
}

/** Absolute URL QStash calls back into — reuses the app's canonical deployed URL. */
export function liveGoalsWebhookUrl(): string {
  const base = process.env.NEXTAUTH_URL;
  if (!base) throw new Error('NEXTAUTH_URL environment variable is not set');
  return `${base.replace(/\/$/, '')}/api/webhooks/qstash/live-goals`;
}
