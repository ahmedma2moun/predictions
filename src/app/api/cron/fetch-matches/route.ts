import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Match } from '@/models/Match';
import { League } from '@/models/League';
import { fetchFixtures, mapFixtureStatus } from '@/lib/football-api';
import { format, addDays } from 'date-fns';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  const fridayStart = new Date();
  fridayStart.setUTCHours(0, 0, 0, 0);
  const nextFriday = addDays(fridayStart, 7);
  const from = format(fridayStart, 'yyyy-MM-dd');
  const to = format(nextFriday, 'yyyy-MM-dd');

  const leagues = await League.find({ isActive: true });
  let inserted = 0, skipped = 0, errors = 0;

  for (const league of leagues) {
    try {
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
    } catch (e) {
      console.error(`Error fetching league ${league.externalId}:`, e);
      errors++;
    }
  }

  return NextResponse.json({ inserted, skipped, errors, timestamp: new Date().toISOString() });
}
