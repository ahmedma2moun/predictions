import { NextRequest, NextResponse } from 'next/server';
import { fetchAndInsertMatches, buildReminderOnlyNotices, getWeeklyFetchWindow } from '@/lib/matches-processor';
import { logger } from '@/lib/logger';
import { sendFetchMatchesCronEmail } from '@/lib/email';
import { verifyCronRequest } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  if (!(await verifyCronRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Today + next 7 days: a Thursday run covers Thursday → next Thursday.
  const { fromDate, from, to } = getWeeklyFetchWindow();

  const { inserted, skipped, errors, insertedMatches, skippedMatches } = await fetchAndInsertMatches({
    from,
    to,
    fromDate,
    filterByTeams: true,
    logPrefix: 'cron/fetch-matches',
  });

  const summary = { inserted, skipped, errors, timestamp: new Date().toISOString() };
  logger.info('[cron/fetch-matches] Done —', JSON.parse(JSON.stringify(summary)));

  try {
    const reminderOnlyMatches = await buildReminderOnlyNotices([...insertedMatches, ...skippedMatches]);
    await sendFetchMatchesCronEmail({ inserted, skipped, errors, insertedMatches, skippedMatches, reminderOnlyMatches, from, to });
  } catch (e) {
    logger.error('[cron/fetch-matches] Failed to send cron notification email:', { error: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json(summary);
}
