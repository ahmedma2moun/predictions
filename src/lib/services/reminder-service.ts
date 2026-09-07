import { prisma } from '@/lib/prisma';

export type ReminderLeague = {
  id: number;
  name: string;
  teams: Array<{ teamLeagueId: number; teamId: number; name: string; logo: string | null }>;
};

export async function getReminderLeagues(): Promise<ReminderLeague[]> {
  const rows = await prisma.teamLeague.findMany({
    where: { reminderEnabled: true, league: { isActive: true } },
    include: { league: { select: { id: true, name: true } }, team: { select: { id: true, name: true, logo: true } } },
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
    include: { teamLeague: { include: { league: { select: { id: true, name: true } }, team: { select: { id: true, name: true, logo: true } } } } },
    orderBy: [{ teamLeague: { league: { name: 'asc' } } }, { teamLeague: { team: { name: 'asc' } } }],
  });
  const byLeague = new Map<number, { id: number; name: string; teams: Array<{ teamLeagueId: number; teamId: number; name: string; logo: string | null }> }>();
  for (const row of rows) {
    if (!row.teamLeague.reminderEnabled) continue;
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
  });
  return getUserReminderPreferences(userId);
}

export async function getReminderRecipientIds(match: { externalLeagueId: number; homeTeamExtId: number; awayTeamExtId: number }) {
  const rows = await prisma.userReminderTeam.findMany({
    where: {
      teamLeague: {
      externalLeagueId: match.externalLeagueId,
      reminderEnabled: true,
      league: { isActive: true },
      team: { externalId: { in: [match.homeTeamExtId, match.awayTeamExtId] } },
      },
    },
    select: { userId: true, teamLeague: { select: { team: { select: { externalId: true } } } } },
  });
  const teamsByUser = new Map<number, Set<number>>();
  for (const row of rows) {
    const set = teamsByUser.get(row.userId) ?? new Set<number>();
    set.add(row.teamLeague.team.externalId);
    teamsByUser.set(row.userId, set);
  }
  return [...teamsByUser].filter(([, teams]) => teams.has(match.homeTeamExtId) && teams.has(match.awayTeamExtId)).map(([userId]) => userId);
}

export async function getReminderTeamsByLeagueMap() {
  const rows = await prisma.teamLeague.findMany({ where: { reminderEnabled: true, league: { isActive: true } }, select: { externalLeagueId: true, team: { select: { externalId: true } } } });
  const map = new Map<number, Set<number>>();
  for (const row of rows) map.set(row.externalLeagueId, new Set([...(map.get(row.externalLeagueId) ?? []), row.team.externalId]));
  return map;
}

export async function getReminderTeamLink(teamLeagueId: number) {
  return prisma.teamLeague.findUnique({ where: { id: teamLeagueId }, select: { id: true, leagueId: true, reminderEnabled: true } });
}
