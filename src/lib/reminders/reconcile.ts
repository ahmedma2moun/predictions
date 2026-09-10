import { prisma } from '@/lib/prisma';
import { drainReminderRefreshes } from './outbox';
import { publishReminderJobs } from './planner';
import { REMINDER_KINDS, reminderWindow } from './policy';

export async function reconcileReminders(now = new Date()) {
  // Hourly provider refresh repairs kickoff/status changes without importing
  // unselected prediction games. User saves can request an earlier refresh.
  const leagues = await prisma.league.findMany({ where: { isActive: true }, select: { id: true } });
  for (const league of leagues) await prisma.reminderRefresh.upsert({ where: { leagueId: league.id }, create: { leagueId: league.id }, update: {} });
  await prisma.$executeRaw`
    UPDATE "ReminderRefresh" SET revision = revision + 1, "nextAttemptAt" = ${now}
    WHERE revision = "completedRevision" AND "updatedAt" < ${new Date(now.getTime() - 3_600_000)}`;
  await prisma.$executeRaw`
    UPDATE "ReminderJob" j SET status = 'superseded', "updatedAt" = ${now}
    FROM "Match" m WHERE j."matchId" = m.id AND j.status IN ('pending', 'queued')
    AND (j."kickoffTime" <> m."kickoffTime" OR m.status IN ('cancelled', 'postponed', 'finished'))`;
  await prisma.$executeRaw`
    UPDATE "ReminderJob" j SET status = 'pending', "queuedAt" = NULL, "updatedAt" = ${now}
    FROM "Match" m WHERE j."matchId" = m.id AND j.status = 'superseded'
    AND j."kickoffTime" = m."kickoffTime" AND m.status = 'scheduled' AND j."dueAt" >= ${now}`;

  // Recover missing schedules (including custom games and import crashes).
  // Cursor pagination prevents leagues with many fixtures from starving others.
  let cursor: number | undefined;
  while (true) {
    const matches = await prisma.match.findMany({
      where: { status: 'scheduled', kickoffTime: { gte: now, lte: new Date(now.getTime() + 8 * 86_400_000) } },
      select: { id: true, kickoffTime: true }, orderBy: { id: 'asc' }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const data = matches.flatMap(match => REMINDER_KINDS.flatMap(kind => {
      const window = reminderWindow(match.kickoffTime, kind);
      return window.dueAt >= now ? [{ matchId: match.id, kickoffTime: match.kickoffTime, kind, ...window }] : [];
    }));
    if (data.length) await prisma.reminderJob.createMany({ data, skipDuplicates: true });
    if (matches.length < 100) break;
    cursor = matches[matches.length - 1].id;
  }
  await prisma.reminderJob.updateMany({ where: { status: { in: ['pending', 'queued'] }, expiresAt: { lte: now } }, data: { status: 'expired' } });
  await publishReminderJobs(now);
  // Slow football-provider calls must not delay publication of already-known jobs.
  await drainReminderRefreshes(new Date());
  return { outcome: 'reconciled' };
}
