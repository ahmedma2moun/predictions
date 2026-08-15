import { NextRequest, NextResponse } from 'next/server';
import { getQStashReceiver } from '@/lib/qstash';
import { sendMatchKickoffReminder } from '@/lib/match-reminder-service';
import { logger } from '@/lib/logger';

interface MatchReminderBody {
  externalId: number;
}

// Same signature-verification auth as /api/webhooks/qstash/live-goals —
// one-shot, no chain (unlike live-goals, this never re-arms itself).
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('upstash-signature') ?? '';

  const valid = await getQStashReceiver().verify({ signature, body }).catch(() => false);
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let parsed: MatchReminderBody;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!parsed.externalId) return NextResponse.json({ error: 'externalId is required' }, { status: 400 });

  const result = await sendMatchKickoffReminder(parsed.externalId).catch(e => {
    logger.error('[match-reminder] Failed:', { externalId: parsed.externalId, error: e instanceof Error ? e.message : String(e) });
    return null;
  });

  if (!result) return NextResponse.json({ error: 'Reminder processing failed' }, { status: 500 });
  return NextResponse.json({ ok: true, ...result });
}
