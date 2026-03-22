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
  const teams = await Team.find(filter).populate('leagueId', 'name').sort({ name: 1 }).lean();
  return NextResponse.json(teams.map(t => ({ ...t, _id: t._id.toString(), leagueId: t.leagueId?.toString() ?? t.leagueId })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const { leagueId } = await req.json();
  const league = await League.findById(leagueId);
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const apiTeams = await fetchTeams(league.externalId, league.season);
  let synced = 0;
  for (const t of apiTeams) {
    await Team.findOneAndUpdate(
      { externalId: t.team.id },
      { externalId: t.team.id, name: t.team.name, logo: t.team.logo, leagueId: league._id, externalLeagueId: league.externalId, isActive: true },
      { upsert: true }
    );
    synced++;
  }
  return NextResponse.json({ synced });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const { id, isActive } = await req.json();
  const team = await Team.findByIdAndUpdate(id, { isActive }, { new: true });
  return NextResponse.json({ ...team?.toObject(), _id: team?._id.toString() });
}
