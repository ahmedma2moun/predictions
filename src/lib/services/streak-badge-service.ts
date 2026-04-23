import { prisma } from '@/lib/prisma';
import { BadgeKey } from '@prisma/client';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { logger } from '@/lib/logger';

type ScoredDetail = {
  userId: number;
  pointsAwarded: number;
  scoringBreakdown: Array<{ key: string; matched: boolean }>;
};

export async function updateUserStreaks(userIds: number[]): Promise<void> {
  if (userIds.length === 0) return;
  await Promise.all(
    userIds.map(async userId => {
      const preds = await PredictionRepository.findMany({
        where: { userId, match: { status: 'finished' } },
        select: { pointsAwarded: true },
        orderBy: { match: { kickoffTime: 'desc' } },
      });

      let currentStreak = 0;
      for (const p of preds) {
        if ((p.pointsAwarded ?? 0) > 0) currentStreak++;
        else break;
      }

      let longestStreak = 0;
      let running = 0;
      for (let i = preds.length - 1; i >= 0; i--) {
        if ((preds[i].pointsAwarded ?? 0) > 0) {
          running++;
          if (running > longestStreak) longestStreak = running;
        } else {
          running = 0;
        }
      }

      await UserRepository.update({
        where: { id: userId },
        data: { currentStreak, longestStreak },
      });
    }),
  );
}

export async function updateStreaksAndBadges(
  matchId: number,
  scoredDetails: ScoredDetail[],
  matchday: number | null,
  externalLeagueId: number,
): Promise<void> {
  if (scoredDetails.length === 0) return;

  const userIds = [...new Set(scoredDetails.map(d => d.userId))];

  await updateUserStreaks(userIds);

  // first_exact_score badge
  for (const detail of scoredDetails) {
    if (detail.scoringBreakdown.some(r => r.key === 'exact_score' && r.matched)) {
      await awardBadgeIfNew(detail.userId, BadgeKey.first_exact_score);
    }
  }

  // on_a_roll badge: awarded when streak first hits 3
  const rollingUsers = await UserRepository.findMany({
    where: { id: { in: userIds }, currentStreak: { gte: 3 } },
    select: { id: true },
  });
  for (const u of rollingUsers) {
    await awardBadgeIfNew(u.id, BadgeKey.on_a_roll);
  }

  // perfect_week badge: check when matchday is fully processed
  if (matchday !== null) {
    await checkPerfectWeekBadge(matchId, userIds, matchday, externalLeagueId);
  }
}

async function checkPerfectWeekBadge(
  currentMatchId: number,
  userIds: number[],
  matchday: number,
  externalLeagueId: number,
): Promise<void> {
  const allMatchdayMatches = await prisma.match.findMany({
    where: { matchday, externalLeagueId },
    select: { id: true, status: true, scoresProcessed: true },
  });

  // All must be finished+processed (treat currentMatchId as done — scoresProcessed is set after this call)
  const allDone = allMatchdayMatches.every(m =>
    m.id === currentMatchId
      ? m.status === 'finished'
      : m.status === 'finished' && m.scoresProcessed,
  );
  if (!allDone) return;

  const matchIds = allMatchdayMatches.map(m => m.id);

  for (const userId of userIds) {
    const preds = await PredictionRepository.findMany({
      where: { userId, matchId: { in: matchIds } },
      select: { pointsAwarded: true },
    });

    if (preds.length === 0) continue;
    if (preds.every(p => (p.pointsAwarded ?? 0) > 0)) {
      await awardBadgeIfNew(userId, BadgeKey.perfect_week);
    }
  }
}

async function awardBadgeIfNew(userId: number, badge: BadgeKey): Promise<void> {
  try {
    await prisma.userBadge.upsert({
      where: { userId_badge: { userId, badge } },
      create: { userId, badge },
      update: {},
    });
  } catch (e) {
    logger.error(`[badges] Failed to award ${badge} to user ${userId}:`, {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
