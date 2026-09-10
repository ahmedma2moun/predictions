import { prisma } from '@/lib/prisma';
import { getReminderRecipientIds } from './subscriptions';
import { reminderPolicies, type ReminderKind } from './policy';

export async function reminderAudience(match: { predictionsEnabled: boolean; externalLeagueId: number; homeTeamExtId: number; awayTeamExtId: number }, kind: ReminderKind) {
  const policies = reminderPolicies(match.predictionsEnabled, kind);
  return policies.predictionPreKickoff ? null : await getReminderRecipientIds(match);
}

export async function reminderTargets(userIds: number[] | null) {
  const where = userIds === null ? {} : { id: { in: userIds } };
  const [emails, devices] = await Promise.all([
    prisma.user.findMany({ where: { ...where, notificationEmail: { not: null } }, select: { id: true } }),
    prisma.deviceToken.findMany({ where: userIds === null ? {} : { userId: { in: userIds } }, select: { id: true, userId: true } }),
  ]);
  return [
    ...emails.map(user => ({ userId: user.id, channel: 'email', targetKey: 'email' })),
    ...devices.map(device => ({ userId: device.userId, channel: 'push', targetKey: String(device.id) })),
  ];
}
