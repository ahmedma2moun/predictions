// Compatibility facade for pre-refactor producers and already-queued QStash jobs.
import { prisma } from '@/lib/prisma';
import { planMatchReminders } from '@/lib/reminders/planner';
import { deliverReminderJob } from '@/lib/reminders/worker';
import { type ReminderKind } from '@/lib/reminders/policy';

export async function registerMatchReminderChain(match: { externalId: number; kickoffTime: Date }) {
  const stored = await prisma.match.findUnique({ where: { externalId: match.externalId }, select: { id: true } });
  if (stored) await planMatchReminders(stored.id);
}

export async function sendMatchKickoffReminder(externalId: number, kind: ReminderKind = 'before') {
  const match = await prisma.match.findUnique({ where: { externalId } });
  if (!match) return { outcome: 'match_not_found' };
  // Legacy payload has no revision: never create jobs or reinterpret it as a new
  // schedule. Existing durable jobs are the only authority after migration.
  const job = await prisma.reminderJob.findUnique({ where: {
    matchId_kickoffTime_kind: { matchId: match.id, kickoffTime: match.kickoffTime, kind },
  } });
  if (!job) return { outcome: 'legacy_job_not_planned' };
  return deliverReminderJob(job.id);
}
