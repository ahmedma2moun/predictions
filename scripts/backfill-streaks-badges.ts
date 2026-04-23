import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { updateUserStreaks } from '@/lib/services/streak-badge-service';
import { BadgeKey } from '@prisma/client';

async function awardBadge(userId: number, badge: BadgeKey) {
  await prisma.userBadge.upsert({
    where: { userId_badge: { userId, badge } },
    create: { userId, badge },
    update: {},
  });
}

async function main() {
  console.log('[backfill] Starting streak + badge backfill…');

  // 1. Recompute streaks for all users with at least one prediction
  const distinctUsers = await prisma.prediction.findMany({
    select: { userId: true },
    distinct: ['userId'],
  });
  const userIds = distinctUsers.map(u => u.userId);
  console.log(`[backfill] Users with predictions: ${userIds.length}`);

  console.log('[backfill] Updating streaks…');
  await updateUserStreaks(userIds);

  // 2. first_exact_score — any prediction with exact_score matched
  console.log('[backfill] Checking first_exact_score…');
  const scoredPreds = await prisma.prediction.findMany({
    where: { pointsAwarded: { gt: 0 } },
    select: { userId: true, scoringBreakdown: true },
  });

  const exactScoreUsers = new Set<number>();
  type BreakdownRow = { key: string; matched: boolean };
  for (const p of scoredPreds) {
    const rules = (p.scoringBreakdown as { rules?: BreakdownRow[] } | null)?.rules ?? [];
    if (rules.some(r => r.key === 'exact_score' && r.matched)) {
      exactScoreUsers.add(p.userId);
    }
  }
  console.log(`[backfill] Awarding first_exact_score to ${exactScoreUsers.size} user(s)`);
  for (const userId of exactScoreUsers) {
    await awardBadge(userId, BadgeKey.first_exact_score);
  }

  // 3. on_a_roll — any user whose longestStreak >= 3
  console.log('[backfill] Checking on_a_roll…');
  const rollUsers = await prisma.user.findMany({
    where: { longestStreak: { gte: 3 } },
    select: { id: true },
  });
  console.log(`[backfill] Awarding on_a_roll to ${rollUsers.length} user(s)`);
  for (const u of rollUsers) {
    await awardBadge(u.id, BadgeKey.on_a_roll);
  }

  // 4. perfect_week — for every fully-processed matchday (league, matchday),
  //    award the badge to each user whose predictions in that matchday were all correct.
  console.log('[backfill] Checking perfect_week…');
  const allMatchdayMatches = await prisma.match.findMany({
    where: { matchday: { not: null } },
    select: { id: true, matchday: true, externalLeagueId: true, status: true, scoresProcessed: true },
  });

  const byMatchday = new Map<string, typeof allMatchdayMatches>();
  for (const m of allMatchdayMatches) {
    const key = `${m.externalLeagueId}:${m.matchday}`;
    const list = byMatchday.get(key) ?? [];
    list.push(m);
    byMatchday.set(key, list);
  }

  let completeMatchdays = 0;
  let perfectAwards = 0;
  for (const [, matches] of byMatchday) {
    const allDone = matches.every(m => m.status === 'finished' && m.scoresProcessed);
    if (!allDone) continue;
    completeMatchdays++;

    const matchIds = matches.map(m => m.id);
    const preds = await prisma.prediction.findMany({
      where: { matchId: { in: matchIds } },
      select: { userId: true, pointsAwarded: true },
    });

    const userAllCorrect = new Map<number, boolean>();
    for (const p of preds) {
      const correct = (p.pointsAwarded ?? 0) > 0;
      const prev = userAllCorrect.get(p.userId);
      if (prev === undefined) userAllCorrect.set(p.userId, correct);
      else if (!correct) userAllCorrect.set(p.userId, false);
    }

    for (const [userId, allCorrect] of userAllCorrect) {
      if (allCorrect) {
        await awardBadge(userId, BadgeKey.perfect_week);
        perfectAwards++;
      }
    }
  }
  console.log(`[backfill] Complete matchdays: ${completeMatchdays}`);
  console.log(`[backfill] perfect_week awards: ${perfectAwards}`);

  // Summary
  const badgeCounts = await prisma.userBadge.groupBy({
    by: ['badge'],
    _count: { _all: true },
  });
  console.log('[backfill] Final badge counts:');
  for (const row of badgeCounts) {
    console.log(`  ${row.badge}: ${row._count._all}`);
  }

  const topStreaks = await prisma.user.findMany({
    where: { longestStreak: { gt: 0 } },
    select: { id: true, name: true, currentStreak: true, longestStreak: true },
    orderBy: { longestStreak: 'desc' },
    take: 5,
  });
  console.log('[backfill] Top streaks:');
  for (const u of topStreaks) {
    console.log(`  ${u.name} (#${u.id}): current=${u.currentStreak} longest=${u.longestStreak}`);
  }

  console.log('[backfill] Done.');
}

main()
  .catch(e => {
    console.error('[backfill] FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
