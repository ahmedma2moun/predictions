import { NextRequest, NextResponse } from 'next/server';
import { fetchAndInsertMatches } from '@/lib/matches-processor';
import { logger } from '@/lib/logger';
import { sendCronRunEmail } from '@/lib/email';
import { format, addDays } from 'date-fns';
import { verifyCronRequest } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  const from = format(weekStart, 'yyyy-MM-dd');
  const to   = format(addDays(weekStart, 7), 'yyyy-MM-dd');

  const { inserted, skipped, errors } = await fetchAndInsertMatches({
    from,
    to,
    weekStart,
    filterByTeams: true,
    logPrefix: 'cron/fetch-matches',
  });

  const summary = { inserted, skipped, errors, timestamp: new Date().toISOString() };
  logger.info('[cron/fetch-matches] Done —', JSON.parse(JSON.stringify(summary)));

  try {
    await sendCronRunEmail('fetch-matches', summary);
  } catch (e) {
    logger.error('[cron/fetch-matches] Failed to send cron notification email:', { error: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json(summary);
}
