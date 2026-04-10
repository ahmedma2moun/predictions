import { NextRequest, NextResponse } from 'next/server';
import { fetchAndInsertMatches } from '@/lib/matches-processor';
import { sendCronRunEmail } from '@/lib/email';
import { format, addDays } from 'date-fns';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret    = process.env.CRON_SECRET;
  const triggerSecret = process.env.TRIGGER_SECRET;
  const isVercelCron  = !!req.headers.get('x-vercel-cron-schedule');
  const authorized =
    isVercelCron ||
    (cronSecret    && authHeader === `Bearer ${cronSecret}`) ||
    (triggerSecret && authHeader === `Bearer ${triggerSecret}`);
  if (!authorized) {
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
    filterByTeams: false,
    logPrefix: 'cron/fetch-matches',
  });

  const summary = { inserted, skipped, errors, timestamp: new Date().toISOString() };
  console.log('[cron/fetch-matches] Done —', JSON.stringify(summary));

  try {
    await sendCronRunEmail('fetch-matches', summary);
  } catch (e) {
    console.error('[cron/fetch-matches] Failed to send cron notification email:', e);
  }

  return NextResponse.json(summary);
}
