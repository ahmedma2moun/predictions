import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getActiveLeagues } from '@/lib/services/league-service';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const leagues = await getActiveLeagues();

  return NextResponse.json(leagues, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  });
}
