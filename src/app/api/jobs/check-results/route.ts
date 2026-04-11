import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { prisma } from '@/lib/prisma';
import { fetchFixtures, mapFixtureStatus } from '@/lib/football-api';
import { calculateScore } from '@/lib/scoring-engine';
import { sendResultsEmail, type ResultMatchForEmail } from '@/lib/email';
import { getUserGroupLeaderboards } from '@/lib/leaderboard';
import { getStandingsMap } from '@/lib/standings';
import { rescheduleSlot, markSlotDone } from '@/lib/result-scheduler';
import { format } from 'date-fns';

const MAX_HOURS_AFTER_KICKOFF = 6;

function getReceiver() {
  return new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });
}

export async function POST(req: NextRequest) {
  // Verify the request comes from QStash
  const signature = req.headers.get('upstash-signature') ?? '';
  const rawBody = await req.text();

  try {
    await getReceiver().verify({ signature, body: rawBody });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { slotId } = JSON.parse(rawBody) as { slotId: string };

  const slot = await prisma.resultCheckSlot.findUnique({ where: { id: slotId } });
  if (!slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }
  if (slot.status === 'done') {
    return NextResponse.json({ message: 'Slot already done' });
  }

  // Safety valve: abandon if we've been checking for too long
  const maxCheckTime = new Date(slot.kickoffTime.getTime() + MAX_HOURS_AFTER_KICKOFF * 60 * 60 * 1000);
  if (new Date() > maxCheckTime) {
    await prisma.resultCheckSlot.update({ where: { id: slotId }, data: { status: 'abandoned' } });
    console.log(`[check-results] Slot ${slotId} abandoned after ${MAX_HOURS_AFTER_KICKOFF}h`);
    return NextResponse.json({ message: 'Abandoned' });
  }

  // Find all pending matches in this kickoff slot
  const pendingMatches = await prisma.match.findMany({
    where: {
      kickoffTime: slot.kickoffTime,
      status: { notIn: ['finished', 'cancelled'] },
    },
    include: { league: { select: { name: true } } },
  });

  console.log(`[check-results] Slot ${slotId} (${slot.kickoffTime.toISOString()}) — ${pendingMatches.length} pending`);

  if (pendingMatches.length === 0) {
    await markSlotDone(slotId);
    return NextResponse.json({ message: 'No pending matches', slotId });
  }

  const [rules, leagues] = await Promise.all([
    prisma.scoringRule.findMany({ where: { isActive: true } }),
    prisma.league.findMany({ where: { isActive: true } }),
  ]);
  const leagueMap = new Map(leagues.map(l => [l.externalId, l]));

  // Group by league for efficient API calls
  const byLeague = new Map<number, typeof pendingMatches>();
  for (const m of pendingMatches) {
    if (!byLeague.has(m.externalLeagueId)) byLeague.set(m.externalLeagueId, []);
    byLeague.get(m.externalLeagueId)!.push(m);
  }

  let updatedCount = 0;
  let scoredCount = 0;
  const userMatchMap = new Map<number, ResultMatchForEmail[]>();

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
        const f = fixtureMap.get(match.externalId);
        if (!f) continue;
        if (mapFixtureStatus(f.fixture.status.short) !== 'finished') continue;

        const homeScore = f.score.fulltime.home ?? f.goals.home;
        const awayScore = f.score.fulltime.away ?? f.goals.away;
        if (homeScore === null || awayScore === null) continue;

        const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';

        const updatedMatch = await prisma.match.update({
          where: { id: match.id },
          data: { status: 'finished', resultHomeScore: homeScore, resultAwayScore: awayScore, resultWinner: winner },
        });
        updatedCount++;
        console.log(`[check-results] Result saved: ${match.homeTeamName} ${homeScore}–${awayScore} ${match.awayTeamName}`);

        if (!updatedMatch.scoresProcessed) {
          const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } });

          for (const pred of predictions) {
            const { totalPoints, breakdown } = calculateScore(
              { homeScore: pred.homeScore, awayScore: pred.awayScore },
              { homeScore, awayScore, winner },
              rules,
            );
            await prisma.prediction.update({
              where: { id: pred.id },
              data: { pointsAwarded: totalPoints, scoringBreakdown: { rules: breakdown } },
            });
            scoredCount++;

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
              scoringBreakdown: breakdown.map(r => ({
                ruleName: r.ruleName,
                pointsAwarded: r.pointsAwarded,
                matched: r.matched,
              })),
            });
            userMatchMap.set(pred.userId, list);
          }

          await prisma.match.update({ where: { id: match.id }, data: { scoresProcessed: true } });
        }
      }
    } catch (e) {
      console.error(`[check-results] ERROR league ${league.name}:`, e);
    }
  }

  // Send results emails
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
        }
      }
    } catch (e) {
      console.error(`[check-results] Failed to send results emails:`, e);
    }
  }

  // Refresh standings for leagues that had updates
  if (updatedCount > 0) {
    try {
      const leaguesWithResults = [...byLeague.keys()]
        .filter(id => leagueMap.has(id))
        .map(id => ({ externalLeagueId: id, season: leagueMap.get(id)!.season }));
      await getStandingsMap(leaguesWithResults, { force: true });
    } catch (e) {
      console.error(`[check-results] Failed to refresh standings:`, e);
    }
  }

  // Check if any matches in the slot are still unfinished
  const remaining = await prisma.match.count({
    where: {
      kickoffTime: slot.kickoffTime,
      status: { notIn: ['finished', 'cancelled'] },
    },
  });

  if (remaining === 0) {
    await markSlotDone(slotId);
    console.log(`[check-results] Slot ${slotId} done — all matches finished`);
  } else {
    await rescheduleSlot(slotId);
    console.log(`[check-results] Slot ${slotId} rescheduled — ${remaining} match(es) still unfinished`);
  }

  return NextResponse.json({ slotId, updated: updatedCount, scored: scoredCount, remaining });
}
