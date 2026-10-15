import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { getActiveLeagues } from '@/lib/services/league-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('mobile.leagues.get', async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const leagues = await getActiveLeagues();

  return NextResponse.json(leagues, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  });
});
