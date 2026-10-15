import { NextRequest, NextResponse } from 'next/server';
import { getQStashReceiver } from '@/lib/qstash';
import { sendScheduledTestNotification } from '@/lib/qstash-test-notification';
import { logger } from '@/lib/logger';
import { withApiLogging } from '@/lib/logging/with-api-logging';

interface TestNotificationBody {
  userId: number;
}

// Same signature-verification auth as /api/webhooks/qstash/live-goals, but
// otherwise fully independent — no Match lookups, no chain, one-shot.
export const POST = withApiLogging('webhooks.qstash.test-notification.post', async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('upstash-signature') ?? '';

  const valid = await getQStashReceiver().verify({ signature, body }).catch(() => false);
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let parsed: TestNotificationBody;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!parsed.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    await sendScheduledTestNotification(parsed.userId);
  } catch (e) {
    logger.error('[qstash-test] Failed to send scheduled test notification:', {
      userId: parsed.userId,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
