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

const LOG = '[check-results]';
const MAX_HOURS_AFTER_KICKOFF = 6;

function getReceiver() {
  return new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });
}

export async function POST(req: NextRequest) {
  console.log(`${LOG} Incoming request from ${req.headers.get('user-agent') ?? 'unknown'}`);

  // Verify the request comes from QStash
  const signature = req.headers.get('upstash-signature') ?? '';
  const rawBody = await req.text();

  try {
    await getReceiver().verify({ signature, body: rawBody });
    console.log(`${LOG} Signature verified`);
  } catch (e) {
    console.error(`${LOG} Signature verification failed:`, e);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { slotId } = JSON.parse(rawBody) as { slotId: string };
  console.log(`${LOG} Processing slotId=${slotId}`);

  const slot = await prisma.resultCheckSlot.findUnique({ where: { id: slotId } });
  if (!slot) {
    console.error(`${LOG} Slot ${slotId} not found in DB`);
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }

  console.log(`${LOG} Slot status=${slot.status} kickoff=${slot.kickoffTime.toISOString()}`);

  if (slot.status === 'done') {
    console.log(`${LOG} Slot already done — skipping`);
    return NextResponse.json({ message: 'Slot already done' });
  }

  // Safety valve: abandon if we've been checking for too long
  const now = new Date();
  const maxCheckTime = new Date(slot.kickoffTime.getTime() + MAX_HOURS_AFTER_KICKOFF * 60 * 60 * 1000);
  if (now > maxCheckTime) {
    console.warn(`${LOG} Slot ${slotId} exceeded ${MAX_HOURS_AFTER_KICKOFF}h cap — marking abandoned`);
    await prisma.resultCheckSlot.update({ where: { id: slotId }, data: { status: 'abandoned' } });
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

  console.log(`${LOG} Slot ${slotId} — ${pendingMatches.length} pending match(es):`);
  for (const m of pendingMatches) {
    console.log(`${LOG}   match ${m.id}: ${m.homeTeamName} vs ${m.awayTeamName} (leagueExtId=${m.externalLeagueId})`);
  }

  if (pendingMatches.length === 0) {
    console.log(`${LOG} No pending matches — marking slot done`);
    await markSlotDone(slotId);
    return NextResponse.json({ message: 'No pending matches', slotId });
  }

  const [rules, leagues] = await Promise.all([
    prisma.scoringRule.findMany({ where: { isActive: true } }),
    prisma.league.findMany({ where: { isActive: true } }),
  ]);
  const leagueMap = new Map(leagues.map(l => [l.externalId, l]));
  console.log(`${LOG} Loaded ${rules.length} scoring rule(s), ${leagues.length} active league(s)`);

  // Group by league for efficient API calls
  const byLeague = new Map<number, typeof pendingMatches>();
  for (const m of pendingMatches) {
    if (!byLeague.has(m.externalLeagueId)) byLeague.set(m.externalLeagueId, []);
    byLeague.get(m.externalLeagueId)!.push(m);
  }
  console.log(`${LOG} Grouped into ${byLeague.size} league batch(es)`);

  let updatedCount = 0;
  let scoredCount = 0;
  let skippedNotFinished = 0;
  const userMatchMap = new Map<number, ResultMatchForEmail[]>();

  for (const [externalLeagueId, batch] of byLeague) {
    const league = leagueMap.get(externalLeagueId);
    if (!league) {
      console.warn(`${LOG} League ${externalLeagueId} not in active leagues — skipping batch`);
      continue;
    }

    const timestamps = batch.map(m => new Date(m.kickoffTime).getTime());
    const from = format(new Date(Math.min(...timestamps)), 'yyyy-MM-dd');
    const to   = format(new Date(Math.max(...timestamps)), 'yyyy-MM-dd');

    console.log(`${LOG} Fetching fixtures — league=${league.name} season=${league.season} from=${from} to=${to}`);

    try {
      const fixtures = await fetchFixtures({ league: externalLeagueId, season: league.season, from, to });
      console.log(`${LOG} API returned ${fixtures.length} fixture(s) for ${league.name}`);
      const fixtureMap = new Map(fixtures.map(f => [f.fixture.id, f]));

      for (const match of batch) {
        const f = fixtureMap.get(match.externalId);
        if (!f) {
          console.warn(`${LOG} Fixture ${match.externalId} (${match.homeTeamName} vs ${match.awayTeamName}) not found in API response`);
          skippedNotFinished++;
          continue;
        }

        const apiStatus = mapFixtureStatus(f.fixture.status.short);
        console.log(`${LOG} Match ${match.id} (${match.homeTeamName} vs ${match.awayTeamName}) — API status: ${f.fixture.status.short} → ${apiStatus}`);

        if (apiStatus !== 'finished') {
          console.log(`${LOG} Match ${match.id} not finished yet — will retry`);
          skippedNotFinished++;
          continue;
        }

        const homeScore = f.score.fulltime.home ?? f.goals.home;
        const awayScore = f.score.fulltime.away ?? f.goals.away;
        if (homeScore === null || awayScore === null) {
          console.warn(`${LOG} Match ${match.id} is finished but scores are null — skipping`);
          skippedNotFinished++;
          continue;
        }

        const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
        console.log(`${LOG} Saving result: ${match.homeTeamName} ${homeScore}–${awayScore} ${match.awayTeamName} (${winner})`);

        const updatedMatch = await prisma.match.update({
          where: { id: match.id },
          data: { status: 'finished', resultHomeScore: homeScore, resultAwayScore: awayScore, resultWinner: winner },
        });
        updatedCount++;

        if (!updatedMatch.scoresProcessed) {
          const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } });
          console.log(`${LOG} Scoring ${predictions.length} prediction(s) for match ${match.id}`);

          for (const pred of predictions) {
            const { totalPoints, breakdown } = calculateScore(
              { homeScore: pred.homeScore, awayScore: pred.awayScore },
              { homeScore, awayScore, winner },
              rules,
            );
            console.log(`${LOG}   user ${pred.userId}: predicted ${pred.homeScore}–${pred.awayScore} → ${totalPoints}pts`);
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
          console.log(`${LOG} Match ${match.id} marked scoresProcessed`);
        } else {
          console.log(`${LOG} Match ${match.id} already scored — skipping prediction scoring`);
        }
      }
    } catch (e) {
      console.error(`${LOG} ERROR fetching/processing league ${league.name} (${externalLeagueId}):`, e);
    }
  }

  console.log(`${LOG} Pass complete — updated=${updatedCount} scored=${scoredCount} stillPending=${skippedNotFinished}`);

  // Send results emails
  if (userMatchMap.size > 0) {
    console.log(`${LOG} Sending results emails to ${userMatchMap.size} user(s)`);
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
          console.log(`${LOG} Results email sent to ${user.notificationEmail}`);
        }
      }
    } catch (e) {
      console.error(`${LOG} Failed to send results emails:`, e);
    }
  }

  // Refresh standings for leagues that had updates
  if (updatedCount > 0) {
    console.log(`${LOG} Refreshing standings`);
    try {
      const leaguesWithResults = [...byLeague.keys()]
        .filter(id => leagueMap.has(id))
        .map(id => ({ externalLeagueId: id, season: leagueMap.get(id)!.season }));
      await getStandingsMap(leaguesWithResults, { force: true });
      console.log(`${LOG} Standings refreshed`);
    } catch (e) {
      console.error(`${LOG} Failed to refresh standings:`, e);
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
    console.log(`${LOG} ✓ Slot ${slotId} DONE — all matches finished`);
  } else {
    await rescheduleSlot(slotId);
    console.log(`${LOG} Slot ${slotId} rescheduled — ${remaining} match(es) still unfinished`);
  }

  return NextResponse.json({ slotId, updated: updatedCount, scored: scoredCount, remaining });
}
