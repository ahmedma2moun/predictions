import { prisma } from '@/lib/prisma';
export async function getReminderHealth() {
  const [jobs, deliveries, refreshes, recentProblems, overdue] = await Promise.all([
    prisma.reminderJob.groupBy({ by: ['status'], _count: true }),
    prisma.reminderDelivery.groupBy({ by: ['status'], _count: true }),
    prisma.reminderRefresh.findMany({ select: { leagueId: true, revision: true, completedRevision: true, lastError: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 25 }),
    prisma.reminderJob.findMany({ where: { OR: [{ lastError: { not: null } }, { status: 'expired' }] }, select: { id: true, matchId: true, kind: true, status: true, lastError: true }, orderBy: { updatedAt: 'desc' }, take: 25 }),
    prisma.reminderJob.count({ where: { status: { in: ['pending', 'queued'] }, dueAt: { lt: new Date(Date.now() - 60_000) } } }),
  ]);
  return { jobs, deliveries, refreshes, recentProblems, overdue, note: 'Accepted means provider acceptance, not device delivery.' };
}
