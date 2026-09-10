import { NextRequest, NextResponse } from 'next/server';
import { getQStashReceiver } from '@/lib/qstash';
import { drainReminderRefreshes } from '@/lib/reminders/outbox';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('upstash-signature') ?? '';
  const valid = await getQStashReceiver().verify({ signature, body }).catch(() => false);
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let leagueId: unknown;
  try {
    leagueId = JSON.parse(body)?.leagueId;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (typeof leagueId !== 'number' || !Number.isSafeInteger(leagueId) || leagueId < 1) {
    return NextResponse.json({ error: 'Invalid leagueId' }, { status: 400 });
  }
  try {
    await drainReminderRefreshes();
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('[reminder-fixture-refresh] Failed', { leagueId, error: error instanceof Error ? error.message : String(error) });
    // Non-2xx responses cause QStash to retry, including scheduling failures
    // after insertion; the processor also schedules already-existing fixtures.
    return NextResponse.json({ error: 'Reminder fixture refresh failed' }, { status: 500 });
  }
}
