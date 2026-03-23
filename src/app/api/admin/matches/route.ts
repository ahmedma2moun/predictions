import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Match } from '@/models/Match';
import { League } from '@/models/League';
import { Team } from '@/models/Team';
import { Prediction } from '@/models/Prediction';
import { ScoringRule } from '@/models/ScoringRule';
import { fetchFixtures, mapFixtureStatus } from '@/lib/football-api';
import { calculateScore } from '@/lib/scoring-engine';
import { format, addDays } from 'date-fns';

function getFridayStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day >= 5 ? day - 5 : 7 - (5 - day);
  const friday = new Date(now);
  friday.setUTCDate(now.getUTCDate() - diff);
  friday.setUTCHours(0, 0, 0, 0);
  return friday;
}

async function getActiveTeamsByLeague(): Promise<Map<number, Set<number>>> {
  const teams = await Team.find({ isActive: true }, { externalId: 1, externalLeagueId: 1 }).lean();
  const map = new Map<number, Set<number>>();
  for (const t of teams) {
    if (!map.has(t.externalLeagueId)) map.set(t.externalLeagueId, new Set());
    map.get(t.externalLeagueId)!.add(t.externalId);
  }
  return map;
}

function filterByActiveTeams(fixtures: any[], activeTeamIds: Set<number> | undefined) {
  if (!activeTeamIds || activeTeamIds.size === 0) return fixtures;
  return fixtures.filter(f =>
    activeTeamIds.has(f.teams.home.id) || activeTeamIds.has(f.teams.away.id)
  );
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

  // ── Fetch results for past matches without results ───────────────────────
  if (action === 'fetch-results') {
    const now = new Date();
    const pendingMatches = await Match.find({
      kickoffTime: { $lt: now },
      status: { $nin: ['finished', 'cancelled'] },
    }).lean();

    if (pendingMatches.length === 0) return NextResponse.json({ updated: 0, scored: 0 });

    const byLeague = new Map<number, typeof pendingMatches>();
    for (const m of pendingMatches) {
      if (!byLeague.has(m.externalLeagueId)) byLeague.set(m.externalLeagueId, []);
      byLeague.get(m.externalLeagueId)!.push(m);
    }

    const leagues = await League.find({ isActive: true }).lean();
    const leagueMap = new Map(leagues.map(l => [l.externalId, l]));
    const rules = await ScoringRule.find({ isActive: true }).lean();
    let updated = 0, scored = 0;

    for (const [externalLeagueId, batch] of byLeague) {
      const league = leagueMap.get(externalLeagueId);
      if (!league) continue;

      const timestamps = batch.map(m => new Date(m.kickoffTime).getTime());
      const from = format(new Date(Math.min(...timestamps)), 'yyyy-MM-dd');
      const to   = format(new Date(Math.max(...timestamps)), 'yyyy-MM-dd');

      try {
        const fixtures = await fetchFixtures({ league: externalLeagueId, season: league.season, from, to });
        const fixtureMap = new Map(fixtures.map(f => [f.fixture.id, f]));

        for (const match of batch) {
          const fixture = fixtureMap.get(match.externalId);
          if (!fixture) continue;
          if (mapFixtureStatus(fixture.fixture.status.short) !== 'finished') continue;

          const homeScore = fixture.score.fulltime.home ?? fixture.goals.home;
          const awayScore = fixture.score.fulltime.away ?? fixture.goals.away;
          if (homeScore === null || awayScore === null) continue;

          const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
          const updatedMatch = await Match.findByIdAndUpdate(
            match._id,
            { status: 'finished', result: { homeScore, awayScore, winner } },
            { new: true }
          );
          if (!updatedMatch || updatedMatch.scoresProcessed) continue;
          updated++;

          const predictions = await Prediction.find({ matchId: match._id });
          for (const pred of predictions) {
            const { totalPoints, breakdown } = calculateScore(
              { homeScore: pred.homeScore, awayScore: pred.awayScore },
              { homeScore, awayScore, winner },
              rules as any
            );
            pred.pointsAwarded = totalPoints;
            pred.scoringBreakdown = { rules: breakdown };
            await pred.save();
            scored++;
          }
          updatedMatch.scoresProcessed = true;
          await updatedMatch.save();
        }
      } catch (e) {
        console.error(`[admin/matches] fetch-results error league ${externalLeagueId}:`, e);
      }
    }

    return NextResponse.json({ updated, scored });
  }

  // ── Fetch past 7 days — upsert matches + save result, no score calc ───────
  if (action === 'fetch-past7') {
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const weekAgo = new Date(today);
    weekAgo.setUTCDate(today.getUTCDate() - 7);
    weekAgo.setUTCHours(0, 0, 0, 0);
    const from = format(weekAgo, 'yyyy-MM-dd');
    const to   = format(today,   'yyyy-MM-dd');

    const [leagues, activeTeamsByLeague] = await Promise.all([
      League.find({ isActive: true }).lean(),
      getActiveTeamsByLeague(),
    ]);
    let inserted = 0;

    for (const league of leagues) {
      try {
        const allFixtures = await fetchFixtures({ league: league.externalId, season: league.season, from, to });
        const fixtures = filterByActiveTeams(allFixtures, activeTeamsByLeague.get(league.externalId));

        const ops = fixtures.map(f => {
          const status     = mapFixtureStatus(f.fixture.status.short);
          const homeScore  = f.score.fulltime.home ?? f.goals.home;
          const awayScore  = f.score.fulltime.away ?? f.goals.away;
          const isFinished = status === 'finished' && homeScore !== null && awayScore !== null;
          const winner     = isFinished ? (homeScore! > awayScore! ? 'home' : awayScore! > homeScore! ? 'away' : 'draw') : undefined;

          const update: any = {
            $setOnInsert: {
              externalId: f.fixture.id,
              leagueId: league._id,
              externalLeagueId: league.externalId,
              homeTeam: { externalId: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
              awayTeam: { externalId: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
              kickoffTime: new Date(f.fixture.date),
              scoresProcessed: false,
              weekStart: weekAgo,
            },
            $set: { status, ...(isFinished ? { result: { homeScore, awayScore, winner } } : {}) },
          };
          return { updateOne: { filter: { externalId: f.fixture.id }, update, upsert: true } };
        });

        if (ops.length > 0) {
          const bw = await Match.bulkWrite(ops);
          inserted += bw.upsertedCount;
        }
      } catch (e) {
        console.error(`[admin/matches] fetch-past7 error league ${league.externalId}:`, e);
      }
    }

    return NextResponse.json({ inserted });
  }

  // ── Fetch upcoming fixtures ──────────────────────────────────────────────
  if (action !== 'fetch' && action !== 'fetch-month') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  let from: string, to: string, fridayStart: Date;
  if (action === 'fetch-month') {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    fridayStart = today;
    from = format(today, 'yyyy-MM-dd');
    to = format(addDays(today, 30), 'yyyy-MM-dd');
  } else {
    fridayStart = getFridayStart();
    from = format(fridayStart, 'yyyy-MM-dd');
    to = format(addDays(fridayStart, 7), 'yyyy-MM-dd');
  }

  const [leagues, activeTeamsByLeague] = await Promise.all([
    leagueId
      ? League.findById(leagueId).then(l => (l ? [l] : []))
      : League.find({ isActive: true }),
    getActiveTeamsByLeague(),
  ]);

  let inserted = 0, skipped = 0;
  const debug: any[] = [];
  for (const league of leagues) {
    try {
      const allFixtures = await fetchFixtures({ league: league.externalId, season: league.season, from, to });
      const activeTeamIds = activeTeamsByLeague.get(league.externalId);
      const fixtures = filterByActiveTeams(allFixtures, activeTeamIds);
      debug.push({ league: league.name, externalId: league.externalId, season: league.season, from, to, allFixtures: allFixtures.length, activeTeams: activeTeamIds?.size ?? 'none', filtered: fixtures.length });

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
    } catch (e: any) {
      debug.push({ league: league.name, externalId: league.externalId, error: e?.message ?? String(e) });
    }
  }

  return NextResponse.json({ inserted, skipped, debug });
}
