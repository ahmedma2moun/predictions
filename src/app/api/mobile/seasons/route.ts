import { NextRequest, NextResponse } from 'next/server';
import { getMobileSession } from '@/lib/mobile-auth';
import { SeasonService } from '@/lib/services/season-service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const seasons = await SeasonService.getPublicSeasons();
  return NextResponse.json(
    seasons.map(s => ({
      id: s.id.toString(),
      name: s.name,
      description: s.description,
      status: s.status,
      startDate: s.startDate,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    })),
  );
}
