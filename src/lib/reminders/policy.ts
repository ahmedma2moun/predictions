export type ReminderKind = 'before' | 'kickoff';
export const REMINDER_KINDS: ReminderKind[] = ['before', 'kickoff'];
export function isReminderKind(value: unknown): value is ReminderKind {
  return value === 'before' || value === 'kickoff';
}

// Policies are independent; their audience union yields one delivery per timing/channel.
export function reminderPolicies(predictionsEnabled: boolean, kind: ReminderKind) {
  return {
    predictionPreKickoff: predictionsEnabled && kind === 'before',
    followedMatch: true,
  };
}

export function reminderWindow(kickoff: Date, kind: ReminderKind) {
  const dueAt = new Date(kickoff.getTime() - (kind === 'before' ? 3_600_000 : 0));
  // Never send a stale "60 minutes" message an hour later. Small transport grace only.
  return { dueAt, expiresAt: new Date(dueAt.getTime() + 5 * 60_000) };
}
