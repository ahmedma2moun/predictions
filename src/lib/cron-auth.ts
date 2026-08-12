import { NextRequest } from 'next/server';
import { getQStashReceiver } from '@/lib/qstash';

/**
 * Accepts Vercel's own cron header, the shared bearer secrets (manual/curl
 * testing), or a valid QStash request signature (schedules created via
 * scripts/setup-qstash-schedules.ts) — same signature check as
 * /api/webhooks/qstash/live-goals, just folded in here since these are GET
 * routes with no body to route around.
 */
export async function verifyCronRequest(req: NextRequest): Promise<boolean> {
  const authHeader    = req.headers.get('authorization');
  const cronSecret    = process.env.CRON_SECRET;
  const triggerSecret = process.env.TRIGGER_SECRET;
  const isVercelCron  = !!req.headers.get('x-vercel-cron-schedule');

  if (isVercelCron) return true;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (triggerSecret && authHeader === `Bearer ${triggerSecret}`) return true;

  const qstashSignature = req.headers.get('upstash-signature');
  if (!qstashSignature) return false;

  const body = await req.text();
  return getQStashReceiver().verify({ signature: qstashSignature, body }).catch(() => false);
}
