import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/admin-auth';
import { SeasonService } from '@/lib/services/season-service';
import { withApiLogging } from '@/lib/logging/with-api-logging';

export const GET = withApiLogging('admin.seasons.get', async function GET() {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seasons = await SeasonService.getAllSeasons();
  return NextResponse.json(seasons.map(s => ({ ...s, id: s.id.toString() })));
});

export const POST = withApiLogging('admin.seasons.post', async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, startDate, oddsEnabled, oddsMin, oddsMax } = body;

  if (!name || !startDate) {
    return NextResponse.json({ error: 'name and startDate are required' }, { status: 400 });
  }

  const season = await SeasonService.createSeason({
    name: String(name),
    description: description ? String(description) : undefined,
    startDate: new Date(startDate),
    oddsEnabled: Boolean(oddsEnabled ?? false),
    oddsMin: oddsMin != null ? Number(oddsMin) : 1.1,
    oddsMax: oddsMax != null ? Number(oddsMax) : 5.0,
  });

  return NextResponse.json({ ...season, id: season.id.toString() }, { status: 201 });
});
