import { prisma } from '@/lib/prisma';
import { enqueueReminderFixtureRefresh } from '@/lib/reminder-fixture-refresh';

export type ReminderLeague = {
  id: number;
  name: string;
  teams: Array<{ teamLeagueId: number; teamId: number; name: string; logo: string | null }>;
};

export async function getReminderLeagues(): Promise<ReminderLeague[]> {
  const rows = await prisma.teamLeague.findMany({
    where: { reminderEnabled: true, league: { isActive: true } },
    include: { league: { select: { id: true, name: true, isActive: true } }, team: { select: { id: true, name: true, logo: true } } },
    orderBy: [{ league: { name: 'asc' } }, { team: { name: 'asc' } }],
  });
  const byLeague = new Map<number, ReminderLeague>();
  for (const row of rows) {
    const league = byLeague.get(row.league.id) ?? { id: row.league.id, name: row.league.name, teams: [] };
    league.teams.push({ teamLeagueId: row.id, teamId: row.team.id, name: row.team.name, logo: row.team.logo });
    byLeague.set(row.league.id, league);
  }
  return [...byLeague.values()].filter(league => league.teams.length >= 2);
}

export async function getUserReminderPreferences(userId: number) {
  const rows = await prisma.userReminderTeam.findMany({
    where: { userId },
    include: { teamLeague: { include: { league: { select: { id: true, name: true, isActive: true } }, team: { select: { id: true, name: true, logo: true } } } } },
    orderBy: [{ teamLeague: { league: { name: 'asc' } } }, { teamLeague: { team: { name: 'asc' } } }],
  });
  const byLeague = new Map<number, { id: number; name: string; teams: Array<{ teamLeagueId: number; teamId: number; name: string; logo: string | null }> }>();
  for (const row of rows) {
    if (!row.teamLeague.reminderEnabled || !row.teamLeague.league.isActive) continue;
    const league = byLeague.get(row.teamLeague.league.id) ?? { id: row.teamLeague.league.id, name: row.teamLeague.league.name, teams: [] };
    league.teams.push({ teamLeagueId: row.teamLeague.id, teamId: row.teamLeague.team.id, name: row.teamLeague.team.name, logo: row.teamLeague.team.logo });
    byLeague.set(row.teamLeague.league.id, league);
  }
  return [...byLeague.values()];
}

export async function saveUserReminderPreferences(userId: number, selections: unknown) {
  if (!Array.isArray(selections)) throw new Error('selections must be an array');
  const ids = selections.map(value => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error('Invalid team selection');
    return value;
  });
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate team selection');
  const eligible = await prisma.teamLeague.findMany({
    where: { id: { in: ids }, reminderEnabled: true, league: { isActive: true } },
    select: { id: true, leagueId: true },
  });
  if (eligible.length !== ids.length) throw new Error('One or more teams are unavailable for reminders');
  const byLeague = new Map<number, number[]>();
  for (const row of eligible) byLeague.set(row.leagueId, [...(byLeague.get(row.leagueId) ?? []), row.id]);
  for (const teamIds of byLeague.values()) if (teamIds.length < 2) throw new Error('Select at least two teams in each league');

  await prisma.$transaction(async tx => {
    await tx.userReminderTeam.deleteMany({ where: { userId } });
    if (eligible.length) await tx.userReminderTeam.createMany({ data: eligible.map(row => ({ userId, teamLeagueId: row.id })) });
    for (const leagueId of byLeague.keys()) await tx.reminderRefresh.upsert({
      where: { leagueId }, create: { leagueId },
      update: { revision: { increment: 1 }, nextAttemptAt: new Date() },
    });
  });
  // Publish only after commit, so the worker sees the saved selections. Queue
  // every selected league on retries too, including when preferences are unchanged.
  try {
    for (const leagueId of byLeague.keys()) await enqueueReminderFixtureRefresh(leagueId);
  } catch {
    // The durable outbox remains pending; the minute reconciliation job retries it.
  }
  return getUserReminderPreferences(userId);
}

export { getReminderRecipientIds, getReminderPairsByLeagueMap, reminderPairKey } from '@/lib/reminders/subscriptions';

export async function getReminderTeamLink(teamLeagueId: number) {
  return prisma.teamLeague.findUnique({ where: { id: teamLeagueId }, select: { id: true, leagueId: true, reminderEnabled: true } });
}
