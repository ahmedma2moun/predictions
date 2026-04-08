import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchFixtures, mapFixtureStatus } from '@/lib/football-api';
import { calculateScore } from '@/lib/scoring-engine';
import { sendResultsEmail, type ResultMatchForEmail } from '@/lib/email';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = format(yesterday, 'yyyy-MM-dd');

  const activeLeagues = await prisma.league.findMany({ where: { isActive: true } });
  const rules = await prisma.scoringRule.findMany({ where: { isActive: true } });
  let updated = 0, scored = 0, errors = 0;

  // Map userId → list of scored matches for email
  const userMatchMap = new Map<number, ResultMatchForEmail[]>();

  console.log(`[cron/fetch-results] Starting — ${activeLeagues.length} active leagues, date: ${dateStr}`);

  for (const league of activeLeagues) {
    try {
      const fixtures = await fetchFixtures({ league: league.externalId, season: league.season, date: dateStr });
      const finished = fixtures.filter(f => mapFixtureStatus(f.fixture.status.short) === 'finished');
      console.log(`[cron/fetch-results] ${league.name}: ${fixtures.length} fixtures, ${finished.length} finished`);

      for (const f of fixtures) {
        const status = mapFixtureStatus(f.fixture.status.short);
        if (status !== 'finished') continue;

        const homeScore = f.score.fulltime.home ?? f.goals.home;
        const awayScore = f.score.fulltime.away ?? f.goals.away;
        if (homeScore === null || awayScore === null) {
          console.warn(`[cron/fetch-results] Skipping fixture ${f.fixture.id} — scores not available yet`);
          continue;
        }

        const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
        const match = await prisma.match.update({
          where: { externalId: f.fixture.id },
          data: { status: 'finished', resultHomeScore: homeScore, resultAwayScore: awayScore, resultWinner: winner },
          include: { league: { select: { name: true } } },
        }).catch(() => null);

        if (!match) {
          console.warn(`[cron/fetch-results] Fixture ${f.fixture.id} not found in DB — skipping`);
          continue;
        }
        updated++;
        console.log(`[cron/fetch-results] Result saved: ${match.homeTeamName} ${homeScore}–${awayScore} ${match.awayTeamName}`);

        if (match.scoresProcessed) {
          console.log(`[cron/fetch-results] Match ${match.id} already scored — skipping`);
          continue;
        }

        const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } });
        console.log(`[cron/fetch-results] Scoring ${predictions.length} predictions for match ${match.id}`);

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

          // Collect for email
          const entry: ResultMatchForEmail = {
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
          };
          const list = userMatchMap.get(pred.userId) ?? [];
          list.push(entry);
          userMatchMap.set(pred.userId, list);
        }

        await prisma.match.update({ where: { id: match.id }, data: { scoresProcessed: true } });
      }
    } catch (e) {
      console.error(`[cron/fetch-results] ERROR league ${league.name} (${league.externalId}):`, e);
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
          await sendResultsEmail(user.notificationEmail, matches);
          console.log(`[cron/fetch-results] Results email sent to ${user.notificationEmail}`);
        }
      }
    } catch (e) {
      console.error('[cron/fetch-results] Failed to send results emails:', e);
    }
  }

  const summary = { updated, scored, errors, timestamp: new Date().toISOString() };
  console.log('[cron/fetch-results] Done —', JSON.stringify(summary));
  return NextResponse.json(summary);
}
