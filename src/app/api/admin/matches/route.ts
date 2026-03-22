import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Match } from '@/models/Match';
import { League } from '@/models/League';
import { fetchFixtures, mapFixtureStatus } from '@/lib/football-api';
import { format, addDays, startOfDay } from 'date-fns';

function getFridayStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day >= 5 ? day - 5 : 7 - (5 - day);
  const friday = new Date(now);
  friday.setUTCDate(now.getUTCDate() - diff);
  friday.setUTCHours(0, 0, 0, 0);
  return friday;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = 50;
  const [matches, total] = await Promise.all([
    Match.find().sort({ kickoffTime: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Match.countDocuments(),
  ]);
  return NextResponse.json({ matches: matches.map(m => ({ ...m, _id: m._id.toString(), leagueId: m.leagueId.toString() })), total, page });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await connectDB();
  const { action, leagueId } = await req.json();

  if (action !== 'fetch') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const fridayStart = getFridayStart();
  const nextFriday = addDays(fridayStart, 7);
  const from = format(fridayStart, 'yyyy-MM-dd');
  const to = format(nextFriday, 'yyyy-MM-dd');

  let leagues;
  if (leagueId) {
    const league = await League.findById(leagueId);
    leagues = league ? [league] : [];
  } else {
    leagues = await League.find({ isActive: true });
  }

  let inserted = 0, skipped = 0;
  for (const league of leagues) {
    const fixtures = await fetchFixtures({ league: league.externalId, season: league.season, from, to });
    const ops = fixtures.map(f => ({
      updateOne: {
        filter: { externalId: f.fixture.id },
        update: {
          $setOnInsert: {
            externalId: f.fixture.id,
            leagueId: league._id,
            externalLeagueId: league.externalId,
            homeTeam: { externalId: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
            awayTeam: { externalId: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
            kickoffTime: new Date(f.fixture.date),
            status: mapFixtureStatus(f.fixture.status.short),
            scoresProcessed: false,
            weekStart: fridayStart,
          },
        },
        upsert: true,
      },
    }));
    if (ops.length > 0) {
      const result = await Match.bulkWrite(ops);
      inserted += result.upsertedCount;
      skipped += result.matchedCount;
    }
  }

  return NextResponse.json({ inserted, skipped });
}
