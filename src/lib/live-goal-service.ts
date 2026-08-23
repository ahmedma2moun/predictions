import type { Match } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { fetchFixtureById, mapFixtureStatus, type APIFixture } from '@/lib/football/service';
import { sendPushToUsers } from '@/lib/fcm';
import { getQStashClient, liveGoalsWebhookUrl } from '@/lib/qstash';
import { logger } from '@/lib/logger';
import { applyMatchResult, sendResultNotifications } from '@/lib/results-processor';
import { type ResultMatchForEmail } from '@/lib/email';
import { ScoringRuleService } from '@/lib/services/scoring-rule-service';
import { LeagueService } from '@/lib/services/league-service';
import { getStandingsMap } from '@/lib/standings';
import {
  LIVE_POLL_INTERVAL_SECONDS,
  HALF_TIME_POLL_SECONDS,
  PRE_KICKOFF_POLL_SECONDS,
  KICKOFF_GRACE_SECONDS,
  MAX_CHAIN_HOURS,
} from '@/lib/live-goal-config';

const FLOW_CONTROL_KEY = 'live-goals';
const FLOW_CONTROL_PARALLELISM = 8; // headroom under QStash free tier's account-wide cap of 10

/**
 * Registers the first wake-up for a newly-inserted match's live-goal polling
 * chain — fires KICKOFF_GRACE_SECONDS after kickoff (giving the provider time
 * to flip the fixture to 'live'), then re-arms itself every
 * LIVE_POLL_INTERVAL_SECONDS until the match is finished/postponed/cancelled.
 * Called from matches-processor.ts right after a fixture with a real
 * externalId is inserted.
 */
export async function registerLiveGoalChain(match: { externalId: number; kickoffTime: Date }): Promise<void> {
  const tick = Math.floor(match.kickoffTime.getTime() / 1000) + KICKOFF_GRACE_SECONDS;
  await publishTick(match.externalId, tick);
}

/**
 * One tick of the live-goal chain: fetch the current fixture state, notify on
 * any new goals since the last tick, and re-arm the next tick unless the match
 * has reached a terminal state or exceeded the safety cap.
 */
export async function processLiveGoalTick(externalId: number, tick: number): Promise<{ outcome: string }> {
  const match = await MatchRepository.findUnique({
    where: { externalId },
    include: { league: { select: { name: true } } },
  });
  if (!match) {
    logger.info('[live-goals] tick: no Match row for this externalId — chain dies here', { externalId });
    return { outcome: 'match_not_found' };
  }

  const fixture = await fetchFixtureById(externalId).catch(e => {
    logger.warn('[live-goals] fetchFixtureById failed, will retry next tick', {
      externalId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  });

  if (!fixture) {
    await rearm(match, tick, LIVE_POLL_INTERVAL_SECONDS);
    return { outcome: 'fetch_failed_rearmed' };
  }

  const appStatus = mapFixtureStatus(fixture.fixture.status.short);
  const rawStatus = fixture.fixture.status.short;

  if (appStatus === 'finished') {
    await processFinishedMatchRealtime(match, fixture);
    logger.info('[live-goals] tick: terminal status, chain stops', { matchId: match.id, externalId, appStatus });
    return { outcome: 'terminal_finished' };
  }

  if (appStatus === 'cancelled' || appStatus === 'postponed') {
    if (match.status !== appStatus) {
      await MatchRepository.update({ where: { id: match.id }, data: { status: appStatus } });
    }
    logger.info('[live-goals] tick: terminal status, chain stops', { matchId: match.id, externalId, appStatus });
    return { outcome: `terminal_${appStatus}` };
  }

  if (appStatus === 'scheduled') {
    await rearm(match, tick, PRE_KICKOFF_POLL_SECONDS);
    logger.info('[live-goals] tick: not started yet, rearmed', { matchId: match.id, externalId, rawStatus, rearmInSeconds: PRE_KICKOFF_POLL_SECONDS });
    return { outcome: 'not_started_rearmed' };
  }

  // Live — diff the score against the last tick this app processed.
  const homeGoals = fixture.score.fulltime.home ?? fixture.goals.home ?? 0;
  const awayGoals = fixture.score.fulltime.away ?? fixture.goals.away ?? 0;
  const prevHome = match.liveHomeScore ?? 0;
  const prevAway = match.liveAwayScore ?? 0;
  const wasNotYetLive = match.status !== 'live';

  // Compare-and-swap: only proceed with notifying if this tick is the one that
  // actually advances the row. Guards against QStash's at-least-once delivery
  // double-firing the same tick and sending a duplicate push.
  const claim = await prisma.match.updateMany({
    where: { id: match.id, liveHomeScore: match.liveHomeScore, liveAwayScore: match.liveAwayScore },
    data: { liveHomeScore: homeGoals, liveAwayScore: awayGoals, status: 'live' },
  });

  const matchStarted = claim.count === 1 && wasNotYetLive;
  if (matchStarted) {
    await notifyMatchStarted(match).catch(e =>
      logger.error('[live-goals] notifyMatchStarted failed:', { matchId: match.id, error: e instanceof Error ? e.message : String(e) }),
    );
  }

  const goalDetected = claim.count === 1 && (homeGoals > prevHome || awayGoals > prevAway);
  if (goalDetected) {
    await notifyGoal(match, fixture, { prevHome, prevAway, homeGoals, awayGoals }).catch(e =>
      logger.error('[live-goals] notifyGoal failed:', { matchId: match.id, error: e instanceof Error ? e.message : String(e) }),
    );
  }

  const delaySeconds = rawStatus === 'HT' ? HALF_TIME_POLL_SECONDS : LIVE_POLL_INTERVAL_SECONDS;
  await rearm(match, tick, delaySeconds);
  logger.info('[live-goals] tick: live, rearmed', {
    matchId: match.id, externalId, rawStatus,
    score: `${homeGoals}-${awayGoals}`, prevScore: `${prevHome}-${prevAway}`,
    matchStarted, goalDetected, rearmInSeconds: delaySeconds,
  });
  return { outcome: 'ticked' };
}

/**
 * Fired exactly once per match, on the first tick that observes the fixture
 * as 'live' (i.e. match.status transitions away from 'scheduled'). Uses the
 * same CAS-guarded claim as goal detection to stay idempotent under QStash's
 * at-least-once delivery.
 */
async function notifyMatchStarted(match: Match): Promise<void> {
  const predictors = await PredictionRepository.findMany({
    where: { matchId: match.id },
    select: { userId: true },
  });
  const userIds = [...new Set(predictors.map(p => p.userId))];
  if (userIds.length === 0) return;

  await sendPushToUsers(userIds, {
    title: 'Kick-off!',
    body: `${match.homeTeamName} vs ${match.awayTeamName} has started`,
    data: { type: 'match_started', matchId: String(match.id) },
  });
}

async function notifyGoal(
  match: Match,
  fixture: APIFixture,
  delta: { prevHome: number; prevAway: number; homeGoals: number; awayGoals: number },
): Promise<void> {
  const scoringTeam: 'home' | 'away' = delta.homeGoals > delta.prevHome ? 'home' : 'away';
  const scorer = fixture.events
    .filter(e => e.type === 'goal' && e.team === scoringTeam)
    .sort((a, b) => a.minute - b.minute)
    .at(-1);

  const predictors = await PredictionRepository.findMany({
    where: { matchId: match.id },
    select: { userId: true },
  });
  const userIds = [...new Set(predictors.map(p => p.userId))];
  if (userIds.length === 0) return;

  const teamName = scoringTeam === 'home' ? match.homeTeamName : match.awayTeamName;
  const scoreLine = `${match.homeTeamName} ${delta.homeGoals}-${delta.awayGoals} ${match.awayTeamName}`;
  const body = scorer ? `${scorer.player} (${scorer.minute}') — ${scoreLine}` : scoreLine;

  await sendPushToUsers(userIds, {
    title: `GOAL! ${teamName}`,
    body,
    data: { type: 'goal', matchId: String(match.id) },
  });
}

/**
 * Real-time counterpart to processMatchResults()'s per-match loop body: the
 * moment this tick sees a match go 'finished', score it immediately instead
 * of waiting for the next fetch-results run. Reuses applyMatchResult() so the
 * actual scoring/Champion-Bonus/streaks logic lives in exactly one place.
 * Idempotent (applyMatchResult short-circuits on scoresProcessed) — safe even
 * if fetch-results (manual admin trigger) also processes this match later.
 * Never throws — a failure here must not break the tick; the admin "Fetch
 * Results" action remains available as a manual fallback.
 */
async function processFinishedMatchRealtime(match: Match & { league: { name: string } | null }, fixture: APIFixture): Promise<void> {
  try {
    const rules = await ScoringRuleService.getAll({ where: { isActive: true } });
    const outcome = await applyMatchResult(match, fixture, rules, '[live-goals]');
    if (!outcome || outcome.alreadyProcessed || outcome.scoredDetails.length === 0) return;

    const userMatchMap = new Map<number, ResultMatchForEmail[]>();
    for (const detail of outcome.scoredDetails) {
      userMatchMap.set(detail.userId, [{
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        kickoffTime: match.kickoffTime,
        leagueName: match.league?.name ?? 'Unknown League',
        resultHomeScore: outcome.updatedMatch.resultHomeScore!,
        resultAwayScore: outcome.updatedMatch.resultAwayScore!,
        predictionHomeScore: detail.predictionHomeScore,
        predictionAwayScore: detail.predictionAwayScore,
        pointsAwarded: detail.pointsAwarded,
        scoringBreakdown: detail.scoringBreakdown,
      }]);
    }
    await sendResultNotifications(userMatchMap, '[live-goals]');

    const league = await LeagueService.getById({ where: { externalId: match.externalLeagueId } });
    if (league) {
      await getStandingsMap([{ externalLeagueId: match.externalLeagueId, season: league.season }], { force: true });
    }
  } catch (e) {
    logger.error('[live-goals] Real-time result processing failed — the admin "Fetch Results" action will need to catch this one', {
      matchId: match.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function rearm(match: Match, tick: number, delaySeconds: number): Promise<void> {
  const elapsedHours = (Date.now() / 1000 - Math.floor(match.kickoffTime.getTime() / 1000)) / 3600;
  if (elapsedHours > MAX_CHAIN_HOURS) {
    logger.error(`[live-goals] Match ${match.id} exceeded ${MAX_CHAIN_HOURS}h without finishing — stopping chain`);
    return;
  }
  if (!match.externalId) return;
  const nextTick = tick + delaySeconds;
  await publishTick(match.externalId, nextTick);
}

/**
 * Admin test hook — publishes an immediate tick for a match's live-goal chain,
 * exercising the full round trip (QStash → signature verify → fetch fixture →
 * diff/notify → rearm) without waiting for kickoff. The tick fires within
 * seconds; its effect (score diff, push, chain rearm) is only observable after
 * the webhook actually runs, not from this call's return value.
 */
export async function triggerLiveGoalTestTick(externalId: number): Promise<void> {
  await publishTick(externalId, Math.floor(Date.now() / 1000));
}

async function publishTick(externalId: number, tick: number): Promise<void> {
  // `tick` is the canonical, un-jittered schedule — stored as-is in the body so
  // the next rearm advances from it cleanly. Jitter (a fixed per-match offset,
  // spreading matches that kick off at the same instant across the QStash
  // parallelism pool) is applied only to the actual delivery time, so it never
  // compounds across a chain's lifetime.
  const jitter = externalId % 30;
  const notBefore = tick + jitter;
  await getQStashClient().publishJSON({
    url: liveGoalsWebhookUrl(),
    body: { matchId: externalId, tick },
    notBefore,
    deduplicationId: `live-goal-${externalId}-${tick}`,
    flowControl: { key: FLOW_CONTROL_KEY, parallelism: FLOW_CONTROL_PARALLELISM },
  });
}
