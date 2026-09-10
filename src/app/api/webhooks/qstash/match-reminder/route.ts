import { NextRequest, NextResponse } from 'next/server';
import { getQStashReceiver } from '@/lib/qstash';
import { sendMatchKickoffReminder } from '@/lib/match-reminder-service';
import { deliverReminderJob } from '@/lib/reminders/worker';
import { isReminderKind } from '@/lib/reminders/policy';
import { logger } from '@/lib/logger';

export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('upstash-signature') ?? '';
  const valid = await getQStashReceiver().verify({ signature, body }).catch(() => false);
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  let parsed: { jobId?: unknown; externalId?: unknown; kind?: unknown };
  try { parsed = JSON.parse(body); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const id = parsed.jobId ?? parsed.externalId;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || (parsed.kind !== undefined && !isReminderKind(parsed.kind))) {
    return NextResponse.json({ error: 'Invalid reminder payload' }, { status: 400 });
  }
  try {
    const result = parsed.jobId !== undefined ? await deliverReminderJob(id) : await sendMatchKickoffReminder(id, parsed.kind === 'kickoff' ? 'kickoff' : 'before');
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error('[match-reminder] Retry required', { id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Reminder processing incomplete' }, { status: 500 });
  }
}
