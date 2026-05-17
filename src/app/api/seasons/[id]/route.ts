import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SeasonService } from '@/lib/services/season-service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const season = await SeasonService.getSeasonWithStandings(Number(id));

  if (!season) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ...season,
    id: season.id.toString(),
    standings: season.standings.map(s => ({
      ...s,
      id: s.id.toString(),
      userId: s.userId.toString(),
    })),
  });
}
