import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { scheduleTestNotification, TEST_NOTIFICATION_DELAY_SECONDS } from '@/lib/qstash-test-notification';
import { safeParseBody } from '@/lib/request';
import { withErrorHandling } from '@/lib/api-handler';

interface QStashTestBody {
  userId: unknown;
}

// Schedules a delayed push to a chosen user via QStash — proves the pipeline
// (publish → wait → webhook → signature verify → push) end-to-end, decoupled
// from any Match/live-goal state. See src/lib/qstash-test-notification.ts.
export const POST = withErrorHandling('admin/qstash-test POST', async (req: NextRequest) => {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await safeParseBody<QStashTestBody>(req);
  const userId = Number(body?.userId);
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    await scheduleTestNotification(userId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message: `Scheduled — expect a push notification in ~${TEST_NOTIFICATION_DELAY_SECONDS}s.`,
  });
});
