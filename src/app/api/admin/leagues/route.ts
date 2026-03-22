import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { Team } from '@/models/Team';
import { fetchLeagues } from '@/lib/football-api';

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const leagues = await League.find().sort({ name: 1 }).lean();
  return NextResponse.json(leagues.map(l => ({ ...l, _id: l._id.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await connectDB();
  const body = await req.json();

  if (body.action === 'fetch') {
    const [apiLeagues, dbLeagues] = await Promise.all([
      fetchLeagues(),
      League.find().lean(),
    ]);
    const activeSet = new Set(dbLeagues.map(l => l.externalId));
    const dbMap = new Map(dbLeagues.map(l => [l.externalId, l._id.toString()]));

    const result = apiLeagues.flatMap(l =>
      l.seasons.filter(s => s.current).map(s => ({
        externalId: l.league.id,
        name: l.league.name,
        country: l.country.name,
        logo: l.league.logo,
        season: s.year,
        isActive: activeSet.has(l.league.id),
        _id: dbMap.get(l.league.id) ?? null,
      }))
    );
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await connectDB();
  const { externalId, name, country, logo, season, isActive } = await req.json();

  if (isActive) {
    const doc = await League.findOneAndUpdate(
      { externalId },
      { externalId, name, country, logo, season, isActive: true },
      { upsert: true, new: true }
    );
    return NextResponse.json({ ...doc.toObject(), _id: doc._id.toString() });
  } else {
    const doc = await League.findOneAndDelete({ externalId });
    if (doc) await Team.deleteMany({ leagueId: doc._id });
    return NextResponse.json({ success: true });
  }
}
