import { NextRequest, NextResponse } from 'next/server';
import { processMatchResults } from '@/lib/results-processor';

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

  const summary = await processMatchResults('cron/fetch-results');
  const result = { ...summary, timestamp: new Date().toISOString() };

  console.log('[cron/fetch-results] Done —', JSON.stringify(result));

  return NextResponse.json(result);
}
