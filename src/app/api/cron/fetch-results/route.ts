import { NextRequest, NextResponse } from 'next/server';
import { processMatchResults } from '@/lib/results-processor';
import { verifyCronRequest } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await processMatchResults('cron/fetch-results');
  const result = { ...summary, timestamp: new Date().toISOString() };

  console.log('[cron/fetch-results] Done —', JSON.stringify(result));

  return NextResponse.json(result);
}
