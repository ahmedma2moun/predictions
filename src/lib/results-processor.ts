import { prisma } from '@/lib/prisma';
import { fetchFixtures, mapFixtureStatus } from '@/lib/football-api';
import { getStandingsMap } from '@/lib/standings';
import { calculateScore } from '@/lib/scoring-engine';
import { sendResultsEmail, type ResultMatchForEmail } from '@/lib/email';
import { getUserGroupLeaderboards } from '@/lib/leaderboard';
import { format } from 'date-fns';

export interface ProcessResultsSummary {
  updated: number;
  scored: number;
  errors: number;
}

/**
 * Finds all past unfinished matches in the DB, fetches their results from the
 * football API, updates scores, calculates prediction points, and sends result
 * emails. Used by both the Vercel cron and the admin "Fetch Results" button.
 */
export async function processMatchResults(logPrefix: string): Promise<ProcessResultsSummary> {
  const now = new Date();

  const pendingMatches = await prisma.match.findMany({
    where: {
      kickoffTime: { lt: now },
      status: { notIn: ['finished', 'cancelled'] },
    },
    include: { league: { select: { name: true } } },
  });

  console.log(`[${logPrefix}] Starting — ${pendingMatches.length} pending matches`);

  if (pendingMatches.length === 0) {
    return { updated: 0, scored: 0, errors: 0 };
  }

  const [rules, leagues] = await Promise.all([
    prisma.scoringRule.findMany({ where: { isActive: true } }),
    prisma.league.findMany({ where: { isActive: true } }),
  ]);
  const leagueMap = new Map(leagues.map(l => [l.externalId, l]));

  // Group pending matches by league so we make one API call per league
  const byLeague = new Map<number, typeof pendingMatches>();
  for (const m of pendingMatches) {
    if (!byLeague.has(m.externalLeagueId)) byLeague.set(m.externalLeagueId, []);
    byLeague.get(m.externalLeagueId)!.push(m);
  }

  let updated = 0, scored = 0, errors = 0;
  const userMatchMap = new Map<number, ResultMatchForEmail[]>();

  for (const [externalLeagueId, batch] of byLeague) {
    const league = leagueMap.get(externalLeagueId);
    if (!league) {
      console.warn(`[${logPrefix}] League ${externalLeagueId} not in active leagues — skipping`);
      continue;
    }

    const timestamps = batch.map(m => new Date(m.kickoffTime).getTime());
    const from = format(new Date(Math.min(...timestamps)), 'yyyy-MM-dd');
    const to   = format(new Date(Math.max(...timestamps)), 'yyyy-MM-dd');

    try {
      const fixtures = await fetchFixtures({ league: externalLeagueId, season: league.season, from, to });
      const fixtureMap = new Map(fixtures.map(f => [f.fixture.id, f]));
      console.log(`[${logPrefix}] ${league.name}: ${fixtures.length} fixtures from API, ${batch.length} pending in DB`);

      for (const match of batch) {
        const f = fixtureMap.get(match.externalId);
        if (!f) {
          console.warn(`[${logPrefix}] Fixture ${match.externalId} not found in API response — skipping`);
          continue;
        }
        if (mapFixtureStatus(f.fixture.status.short) !== 'finished') continue;

        const rawHomeScore = f.score.fulltime.home ?? f.goals.home;
        const rawAwayScore = f.score.fulltime.away ?? f.goals.away;
        if (rawHomeScore === null || rawAwayScore === null) {
          console.warn(`[${logPrefix}] Fixture ${f.fixture.id} — scores not available yet`);
          continue;
        }

        const isPenalty = f.score.duration === 'PENALTY_SHOOTOUT';
        const penaltyHomeScore = isPenalty ? (f.score.penalties?.home ?? null) : null;
        const penaltyAwayScore = isPenalty ? (f.score.penalties?.away ?? null) : null;

        // The API adds penalty goals to fullTime for PENALTY_SHOOTOUT matches — subtract to get the actual match score
        const homeScore = isPenalty && penaltyHomeScore !== null ? rawHomeScore - penaltyHomeScore : rawHomeScore;
        const awayScore = isPenalty && penaltyAwayScore !== null ? rawAwayScore - penaltyAwayScore : rawAwayScore;

        // Full-time winner (used for scoring — penalties are ignored)
        const scoringWinner: 'home' | 'away' | 'draw' =
          homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';

        // Stored winner: if match ended level and went to penalties, penalty winner is recorded
        let winner: 'home' | 'away' | 'draw';
        if (scoringWinner !== 'draw') {
          winner = scoringWinner;
        } else if (isPenalty && penaltyHomeScore !== null && penaltyAwayScore !== null) {
          winner = penaltyHomeScore > penaltyAwayScore ? 'home' : 'away';
        } else {
          winner = 'draw';
        }

        const updatedMatch = await prisma.match.update({
          where: { id: match.id },
          data: {
            status: 'finished',
            resultHomeScore: homeScore,
            resultAwayScore: awayScore,
            resultPenaltyHomeScore: penaltyHomeScore,
            resultPenaltyAwayScore: penaltyAwayScore,
            resultWinner: winner,
          },
        });
        updated++;
        console.log(`[${logPrefix}] Result saved: ${match.homeTeamName} ${homeScore}–${awayScore} ${match.awayTeamName}`);

        if (updatedMatch.scoresProcessed) {
          console.log(`[${logPrefix}] Match ${match.id} already scored — skipping`);
          continue;
        }

        const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } });
        console.log(`[${logPrefix}] Scoring ${predictions.length} predictions for match ${match.id}`);

        for (const pred of predictions) {
          const { totalPoints, breakdown } = calculateScore(
            { homeScore: pred.homeScore, awayScore: pred.awayScore },
            { homeScore, awayScore, winner: scoringWinner },
            rules
          );
          await prisma.prediction.update({
            where: { id: pred.id },
            data: { pointsAwarded: totalPoints, scoringBreakdown: { rules: breakdown } },
          });
          scored++;

          const list = userMatchMap.get(pred.userId) ?? [];
          list.push({
            homeTeamName: match.homeTeamName,
            awayTeamName: match.awayTeamName,
            kickoffTime: match.kickoffTime,
            leagueName: match.league?.name ?? 'Unknown League',
            resultHomeScore: homeScore,
            resultAwayScore: awayScore,
            predictionHomeScore: pred.homeScore,
            predictionAwayScore: pred.awayScore,
            pointsAwarded: totalPoints,
            scoringBreakdown: breakdown.map(r => ({ ruleName: r.ruleName, pointsAwarded: r.pointsAwarded, matched: r.matched })),
          });
          userMatchMap.set(pred.userId, list);
        }

        await prisma.match.update({ where: { id: match.id }, data: { scoresProcessed: true } });
      }
    } catch (e) {
      console.error(`[${logPrefix}] ERROR league ${league.name} (${externalLeagueId}):`, e);
      errors++;
    }
  }

  // Send personalized results emails
  if (userMatchMap.size > 0) {
    try {
      const userIds = [...userMatchMap.keys()];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, notificationEmail: { not: null } },
        select: { id: true, notificationEmail: true },
      });
      for (const user of users) {
        const matches = userMatchMap.get(user.id);
        if (user.notificationEmail && matches?.length) {
          const leaderboards = await getUserGroupLeaderboards(user.id);
          await sendResultsEmail(user.notificationEmail, matches, leaderboards);
          console.log(`[${logPrefix}] Results email sent to ${user.notificationEmail}`);
        }
      }
    } catch (e) {
      console.error(`[${logPrefix}] Failed to send results emails:`, e);
    }
  }

  // Refresh standings for every league that had results processed
  if (updated > 0) {
    const leaguesWithResults = [...byLeague.keys()]
      .filter(id => leagueMap.has(id))
      .map(id => ({ externalLeagueId: id, season: leagueMap.get(id)!.season }));

    try {
      await getStandingsMap(leaguesWithResults, { force: true });
      console.log(`[${logPrefix}] Standings refreshed for ${leaguesWithResults.length} league(s)`);
    } catch (e) {
      console.error(`[${logPrefix}] Failed to refresh standings:`, e);
    }
  }

  return { updated, scored, errors };
}
