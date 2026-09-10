import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { refreshReminderFixtures } from '@/lib/reminder-fixture-refresh';

export async function drainReminderRefreshes(now = new Date()) {
  // SQL compares revisions, so already-processed leagues cannot starve pending rows.
  const pending = await prisma.$queryRaw<Array<{ leagueId: number; revision: number }>>`
    SELECT "leagueId", revision FROM "ReminderRefresh"
    WHERE revision > "completedRevision" AND "nextAttemptAt" <= ${now}
      AND ("leaseUntil" IS NULL OR "leaseUntil" < ${now})
    ORDER BY "nextAttemptAt" ASC LIMIT 5`;
  for (const row of pending) {
    const token = randomUUID();
    const claim = await prisma.reminderRefresh.updateMany({ where: {
      leagueId: row.leagueId, revision: row.revision,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    }, data: { leaseToken: token, leaseUntil: new Date(now.getTime() + 120_000) } });
    if (!claim.count) continue;
    try {
      await refreshReminderFixtures(row.leagueId);
      await prisma.reminderRefresh.updateMany({ where: { leagueId: row.leagueId, leaseToken: token }, data: {
        completedRevision: row.revision, leaseToken: null, leaseUntil: null, lastError: null,
      } });
    } catch (error) {
      await prisma.reminderRefresh.updateMany({ where: { leagueId: row.leagueId, leaseToken: token }, data: {
        leaseToken: null, leaseUntil: null, nextAttemptAt: new Date(Date.now() + 60_000),
        lastError: error instanceof Error ? error.message : 'Fixture refresh failed',
      } });
    }
  }
}
