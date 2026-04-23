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
    await checkPerfectWeekBadge(matchId, matchday, externalLeagueId);
  }
}

async function checkPerfectWeekBadge(
  currentMatchId: number,
  matchday: number,
  externalLeagueId: number,
): Promise<void> {
  const allMatchdayMatches = await prisma.match.findMany({
    where: { matchday, externalLeagueId },
    select: { id: true, status: true, scoresProcessed: true },
  });

  // Postponed/cancelled matches will never be scored — treat them as done.
  // For the current match scoresProcessed is set before this call, so only
  // check status. All other finished matches must also have been fully scored.
  const allDone = allMatchdayMatches.every(m => {
    if (m.status === 'postponed' || m.status === 'cancelled') return true;
    if (m.id === currentMatchId) return m.status === 'finished';
    return m.status === 'finished' && m.scoresProcessed;
  });
  if (!allDone) return;

  // Only consider playable matches when checking predictions
  const matchIds = allMatchdayMatches
    .filter(m => m.status !== 'postponed' && m.status !== 'cancelled')
    .map(m => m.id);
  if (matchIds.length === 0) return;

  // Check every user who predicted ANY match in this matchday, not just the
  // users who predicted the current match (they may have already been processed
  // when an earlier match in the matchday was scored).
  const predUsers = await prisma.prediction.findMany({
    where: { matchId: { in: matchIds } },
    select: { userId: true },
    distinct: ['userId'],
  });

  for (const { userId } of predUsers) {
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

export async function awardAllTimeGroupChampions(): Promise<{ awarded: number; groups: number; winners: Array<{ groupId: number; groupName: string; userId: number; totalPoints: number }> }> {
  const groups = await prisma.group.findMany({
    select: { id: true, name: true, members: { select: { userId: true } } },
  });

  let awarded = 0;
  const winners: Array<{ groupId: number; groupName: string; userId: number; totalPoints: number }> = [];

  for (const group of groups) {
    if (group.members.length === 0) continue;
    const memberIds = group.members.map(m => m.userId);

    const totals = await prisma.prediction.groupBy({
      by: ['userId'],
      where: { userId: { in: memberIds }, match: { status: 'finished' } },
      _sum: { pointsAwarded: true },
    });

    if (totals.length === 0) continue;

    const top = totals.reduce((best, curr) =>
      (curr._sum.pointsAwarded ?? 0) > (best._sum.pointsAwarded ?? 0) ? curr : best,
    );
    const topPts = top._sum.pointsAwarded ?? 0;
    if (topPts <= 0) continue;

    await awardBadgeIfNew(top.userId, BadgeKey.group_champion);
    awarded++;
    winners.push({ groupId: group.id, groupName: group.name, userId: top.userId, totalPoints: topPts });
  }

  return { awarded, groups: groups.length, winners };
}
