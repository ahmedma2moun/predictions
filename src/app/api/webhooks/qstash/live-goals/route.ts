import { NextRequest, NextResponse } from 'next/server';
import { getQStashReceiver } from '@/lib/qstash';
import { processLiveGoalTick } from '@/lib/live-goal-service';
import { logger } from '@/lib/logger';

interface LiveGoalTickBody {
  matchId: number;
  tick: number;
}

// Auth here is QStash's request signature (Upstash-Signature header verified
// against QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY) — distinct from
// the CRON_SECRET/TRIGGER_SECRET bearer-token pattern used by /api/cron/*,
// which is why this route lives under /api/webhooks instead.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('upstash-signature') ?? '';

  const valid = await getQStashReceiver().verify({ signature, body }).catch(() => false);
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let parsed: LiveGoalTickBody;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { matchId: externalId, tick } = parsed;
  if (!externalId || !tick) {
    return NextResponse.json({ error: 'matchId and tick are required' }, { status: 400 });
  }

  const result = await processLiveGoalTick(externalId, tick).catch(e => {
    logger.error('[live-goals] Tick failed:', { externalId, error: e instanceof Error ? e.message : String(e) });
    return null;
  });

  if (!result) return NextResponse.json({ error: 'Tick processing failed' }, { status: 500 });
  return NextResponse.json({ ok: true, ...result });
}
