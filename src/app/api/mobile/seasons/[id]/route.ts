import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { SeasonService } from '@/lib/services/season-service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const season = await SeasonService.getSeasonWithStandings(Number(id));
  if (!season) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: season.id.toString(),
    name: season.name,
    description: season.description,
    status: season.status,
    startDate: season.startDate,
    startedAt: season.startedAt,
    endedAt: season.endedAt,
    standings: season.standings.map(s => ({
      id: s.id.toString(),
      rank: s.rank,
      totalPoints: s.totalPoints,
      groupId: s.groupId,
      groupName: s.groupName,
      userId: s.userId.toString(),
      userName: s.userName,
    })),
  });
}
