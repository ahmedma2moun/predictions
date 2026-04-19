import { NextRequest, NextResponse } from 'next/server';
import { processMatchResults } from '@/lib/results-processor';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const utcHour = new Date().getUTCHours();
  // CLT = UTC+2; active window is 3 PM–2 AM CLT = 13:00–23:59 UTC
  if (utcHour < 13) {
    return NextResponse.json({ updated: 0, scored: 0, errors: 0, skipped: true, timestamp: new Date().toISOString() });
  }

  const summary = await processMatchResults('cron/fetch-results');
  const result = { ...summary, timestamp: new Date().toISOString() };

  logger.info('[cron/fetch-results] Done —', JSON.parse(JSON.stringify(result)));

  return NextResponse.json(result);
}
