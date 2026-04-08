import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchFixtures, mapFixtureStatus, type APIFixture } from '@/lib/football-api';
import { calculateScore } from '@/lib/scoring-engine';
import { serializeMatch } from '@/models/Match';
import { sendNewMatchesEmail, sendResultsEmail, type MatchForEmail, type ResultMatchForEmail } from '@/lib/email';
import { format, addDays } from 'date-fns';


async function getActiveTeamsByLeague(): Promise<Map<number, Set<number>>> {
  const teams = await prisma.team.findMany({
    where: { isActive: true },
    select: { externalId: true, externalLeagueId: true },
  });
  const map = new Map<number, Set<number>>();
  for (const t of teams) {
    if (!map.has(t.externalLeagueId)) map.set(t.externalLeagueId, new Set());
    map.get(t.externalLeagueId)!.add(t.externalId);
  }
  return map;
}

function filterByActiveTeams(fixtures: APIFixture[], activeTeamIds: Set<number> | undefined) {
  if (!activeTeamIds || activeTeamIds.size === 0) return fixtures;
  return fixtures.filter(f =>
    activeTeamIds.has(f.teams.home.id) || activeTeamIds.has(f.teams.away.id)
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = 50;

  const [matches, total] = await Promise.all([
    prisma.match.findMany({ orderBy: { kickoffTime: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.match.count(),
  ]);

  return NextResponse.json({ matches: matches.map(serializeMatch), total, page });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { action, leagueId } = await req.json();

  // ── Fetch results for past matches without results ─────────────────────────
  if (action === 'fetch-results') {
    const now = new Date();
    const pendingMatches = await prisma.match.findMany({
      where: {
        kickoffTime: { lt: now },
        status: { notIn: ['finished', 'cancelled'] },
      },
    });

    if (pendingMatches.length === 0) return NextResponse.json({ updated: 0, scored: 0 });

    const byLeague = new Map<number, typeof pendingMatches>();
    for (const m of pendingMatches) {
      if (!byLeague.has(m.externalLeagueId)) byLeague.set(m.externalLeagueId, []);
      byLeague.get(m.externalLeagueId)!.push(m);
    }

    const leagues = await prisma.league.findMany({ where: { isActive: true } });
    const leagueMap = new Map(leagues.map(l => [l.externalId, l]));
    const rules = await prisma.scoringRule.findMany({ where: { isActive: true } });
    let updated = 0, scored = 0;
    const userMatchMap = new Map<number, ResultMatchForEmail[]>();

    for (const [externalLeagueId, batch] of byLeague) {
      const league = leagueMap.get(externalLeagueId);
      if (!league) continue;

      const timestamps = batch.map(m => new Date(m.kickoffTime).getTime());
      const from = format(new Date(Math.min(...timestamps)), 'yyyy-MM-dd');
      const to   = format(new Date(Math.max(...timestamps)), 'yyyy-MM-dd');

      try {
        const fixtures = await fetchFixtures({ league: externalLeagueId, season: league.season, from, to });
        const fixtureMap = new Map(fixtures.map((f: APIFixture) => [f.fixture.id, f]));

        for (const match of batch) {
          const fixture = fixtureMap.get(match.externalId);
          if (!fixture) continue;
          if (mapFixtureStatus(fixture.fixture.status.short) !== 'finished') continue;

          const homeScore = fixture.score.fulltime.home ?? fixture.goals.home;
          const awayScore = fixture.score.fulltime.away ?? fixture.goals.away;
          if (homeScore === null || awayScore === null) continue;

          const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
          const updatedMatch = await prisma.match.update({
            where: { id: match.id },
            data: { status: 'finished', resultHomeScore: homeScore, resultAwayScore: awayScore, resultWinner: winner },
          });
          if (updatedMatch.scoresProcessed) continue;
          updated++;

          const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } });
          for (const pred of predictions) {
            const { totalPoints, breakdown } = calculateScore(
              { homeScore: pred.homeScore, awayScore: pred.awayScore },
              { homeScore, awayScore, winner },
              rules
            );
            await prisma.prediction.update({
              where: { id: pred.id },
              data: { pointsAwarded: totalPoints, scoringBreakdown: { rules: breakdown } },
            });
            scored++;

            const entry: ResultMatchForEmail = {
              homeTeamName: match.homeTeamName,
              awayTeamName: match.awayTeamName,
              kickoffTime: match.kickoffTime,
              leagueName: leagueMap.get(match.externalLeagueId)?.name ?? 'Unknown League',
              resultHomeScore: homeScore,
              resultAwayScore: awayScore,
              predictionHomeScore: pred.homeScore,
              predictionAwayScore: pred.awayScore,
              pointsAwarded: totalPoints,
              scoringBreakdown: breakdown.map(r => ({ ruleName: r.ruleName, pointsAwarded: r.pointsAwarded, matched: r.matched })),
            };
            const list = userMatchMap.get(pred.userId) ?? [];
            list.push(entry);
            userMatchMap.set(pred.userId, list);
          }
          await prisma.match.update({ where: { id: match.id }, data: { scoresProcessed: true } });
        }
      } catch (e) {
        console.error(`[admin/matches] fetch-results error league ${externalLeagueId}:`, e);
      }
    }

    if (userMatchMap.size > 0) {
      try {
        const userIds = [...userMatchMap.keys()];
        const users = await prisma.user.findMany({
          where: { id: { in: userIds }, notificationEmail: { not: null } },
          select: { id: true, notificationEmail: true },
        });
        for (const user of users) {
          const matches = userMatchMap.get(user.id);
          if (matches?.length) await sendResultsEmail(user.notificationEmail, matches);
        }
      } catch (e) {
        console.error('[admin/matches] Failed to send results emails:', e);
      }
    }

    return NextResponse.json({ updated, scored });
  }

  // ── Fetch past 7 days — upsert matches + save result, no score calc ─────────
  if (action === 'fetch-past7') {
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const weekAgo = new Date(today);
    weekAgo.setUTCDate(today.getUTCDate() - 7);
    weekAgo.setUTCHours(0, 0, 0, 0);
    const from = format(weekAgo, 'yyyy-MM-dd');
    const to   = format(today,   'yyyy-MM-dd');

    const [leagues, activeTeamsByLeague] = await Promise.all([
      prisma.league.findMany({ where: { isActive: true } }),
      getActiveTeamsByLeague(),
    ]);
    let inserted = 0;

    for (const league of leagues) {
      try {
        const allFixtures = await fetchFixtures({ league: league.externalId, season: league.season, from, to });
        const fixtures = filterByActiveTeams(allFixtures, activeTeamsByLeague.get(league.externalId));

        // Check which ones already exist
        const fixtureIds = fixtures.map((f: APIFixture) => f.fixture.id);
        const existing = new Set(
          (await prisma.match.findMany({ where: { externalId: { in: fixtureIds } }, select: { externalId: true } }))
            .map(m => m.externalId)
        );

        const toCreate = fixtures.filter((f: APIFixture) => !existing.has(f.fixture.id));
        for (const f of toCreate) {
          const status     = mapFixtureStatus(f.fixture.status.short);
          const homeScore  = f.score.fulltime.home ?? f.goals.home;
          const awayScore  = f.score.fulltime.away ?? f.goals.away;
          const isFinished = status === 'finished' && homeScore !== null && awayScore !== null;
          const winner     = isFinished ? (homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw') : null;

          await prisma.match.create({
            data: {
              externalId: f.fixture.id,
              leagueId: league.id,
              externalLeagueId: league.externalId,
              homeTeamExtId: f.teams.home.id,
              homeTeamName: f.teams.home.name,
              homeTeamLogo: f.teams.home.logo,
              awayTeamExtId: f.teams.away.id,
              awayTeamName: f.teams.away.name,
              awayTeamLogo: f.teams.away.logo,
              kickoffTime: new Date(f.fixture.date),
              status,
              scoresProcessed: false,
              weekStart: weekAgo,
              ...(isFinished ? { resultHomeScore: homeScore, resultAwayScore: awayScore, resultWinner: winner } : {}),
            },
          });
          inserted++;
        }
      } catch (e) {
        console.error(`[admin/matches] fetch-past7 error league ${league.externalId}:`, e);
      }
    }

    return NextResponse.json({ inserted });
  }

  // ── Fetch upcoming fixtures ──────────────────────────────────────────────
  if (action !== 'fetch' && action !== 'fetch-month') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let from: string, to: string, fridayStart: Date;
  if (action === 'fetch-month') {
    fridayStart = today;
    from = format(today, 'yyyy-MM-dd');
    to = format(addDays(today, 30), 'yyyy-MM-dd');
  } else {
    fridayStart = today;
    from = format(today, 'yyyy-MM-dd');
    to = format(addDays(today, 7), 'yyyy-MM-dd');
  }

  const [leagues, activeTeamsByLeague] = await Promise.all([
    leagueId
      ? prisma.league.findUnique({ where: { id: Number(leagueId) } }).then(l => (l ? [l] : []))
      : prisma.league.findMany({ where: { isActive: true } }),
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

      const fixtureIds = fixtures.map((f: APIFixture) => f.fixture.id);
      const existing = new Set(
        (await prisma.match.findMany({ where: { externalId: { in: fixtureIds } }, select: { externalId: true } }))
          .map(m => m.externalId)
      );

      const toCreate = fixtures.filter((f: APIFixture) => !existing.has(f.fixture.id));
      skipped += fixtures.length - toCreate.length;

      if (toCreate.length > 0) {
        await prisma.match.createMany({
          data: toCreate.map((f: APIFixture) => ({
            externalId: f.fixture.id,
            leagueId: league.id,
            externalLeagueId: league.externalId,
            homeTeamExtId: f.teams.home.id,
            homeTeamName: f.teams.home.name,
            homeTeamLogo: f.teams.home.logo,
            awayTeamExtId: f.teams.away.id,
            awayTeamName: f.teams.away.name,
            awayTeamLogo: f.teams.away.logo,
            kickoffTime: new Date(f.fixture.date),
            status: mapFixtureStatus(f.fixture.status.short),
            scoresProcessed: false,
            weekStart: fridayStart,
          })),
        });
        inserted += toCreate.length;
      }
    } catch (e: any) {
      debug.push({ league: league.name, externalId: league.externalId, error: e?.message ?? String(e) });
    }
  }

  if (inserted > 0) {
    try {
      const newMatches = await prisma.match.findMany({
        where: { weekStart: fridayStart, status: 'scheduled' },
        include: { league: { select: { name: true } } },
        orderBy: { kickoffTime: 'asc' },
      });
      const matchesForEmail: MatchForEmail[] = newMatches.map(m => ({
        homeTeamName: m.homeTeamName,
        awayTeamName: m.awayTeamName,
        kickoffTime: m.kickoffTime,
        leagueName: m.league?.name ?? 'Unknown League',
      }));
      const recipients = await prisma.user.findMany({
        where: { notificationEmail: { not: null } },
        select: { notificationEmail: true },
      });
      for (const user of recipients) {
        await sendNewMatchesEmail(user.notificationEmail, matchesForEmail);
      }
    } catch (e) {
      console.error('[admin/matches] Failed to send new matches emails:', e);
    }
  }

  return NextResponse.json({ inserted, skipped, debug });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No ids provided' }, { status: 400 });

  const numericIds = ids.map((id: string) => Number(id)).filter((id: number) => !isNaN(id));
  const result = await prisma.match.deleteMany({ where: { id: { in: numericIds } } });
  return NextResponse.json({ deleted: result.count });
}
