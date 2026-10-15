import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SeasonService } from '@/lib/services/season-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('seasons.get', async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const seasons = await SeasonService.getPublicSeasons();
  return NextResponse.json(seasons.map(s => ({ ...s, id: s.id.toString() })));
});
