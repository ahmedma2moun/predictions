import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Team } from '@/models/Team';
import { League } from '@/models/League';
import { fetchTeams } from '@/lib/football-api';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  const filter = leagueId ? { leagueId } : {};
  const teams = await Team.find(filter).sort({ name: 1 }).lean();
  return NextResponse.json(teams.map(t => ({ ...t, _id: t._id.toString(), leagueId: t.leagueId?.toString() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await connectDB();
  const { leagueId } = await req.json();
  const league = await League.findById(leagueId);
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const [apiTeams, dbTeams] = await Promise.all([
    fetchTeams(league.externalId, league.season),
    Team.find({ leagueId: league._id }).lean(),
  ]);

  const activeSet = new Set(dbTeams.map(t => t.externalId));
  const dbMap = new Map(dbTeams.map(t => [t.externalId, t._id.toString()]));

  const result = apiTeams.map(t => ({
    externalId: t.team.id,
    name: t.team.name,
    logo: t.team.logo,
    leagueId: league._id.toString(),
    externalLeagueId: league.externalId,
    isActive: activeSet.has(t.team.id),
    _id: dbMap.get(t.team.id) ?? null,
  }));

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await connectDB();
  const { externalId, name, logo, leagueId, externalLeagueId, isActive } = await req.json();

  if (isActive) {
    const doc = await Team.findOneAndUpdate(
      { externalId },
      { externalId, name, logo, leagueId, externalLeagueId, isActive: true },
      { upsert: true, new: true }
    );
    return NextResponse.json({ ...doc.toObject(), _id: doc._id.toString() });
  } else {
    await Team.findOneAndDelete({ externalId });
    return NextResponse.json({ success: true });
  }
}
