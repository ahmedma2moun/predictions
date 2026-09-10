import { prisma } from '@/lib/prisma';

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

/** Canonical key for an unordered pair of team externalIds. */
export function reminderPairKey(teamA: number, teamB: number): string {
  return teamA < teamB ? `${teamA}:${teamB}` : `${teamB}:${teamA}`;
}

/**
 * Per external league id, the set of team-pair keys where at least ONE user has
 * selected BOTH teams for reminders. Admin-enabling a team is not enough on its
 * own — the fetch flow only ingests a reminder-driven fixture when some user's
 * selection covers both of its teams, mirroring getReminderRecipientIds().
 */
export async function getReminderPairsByLeagueMap(externalLeagueId?: number): Promise<Map<number, Set<string>>> {
  const rows = await prisma.userReminderTeam.findMany({
    where: { teamLeague: { externalLeagueId, reminderEnabled: true, league: { isActive: true } } },
    select: { userId: true, teamLeague: { select: { externalLeagueId: true, team: { select: { externalId: true } } } } },
  });
  const teamsByLeagueUser = new Map<number, Map<number, number[]>>();
  for (const row of rows) {
    const byUser = teamsByLeagueUser.get(row.teamLeague.externalLeagueId) ?? new Map<number, number[]>();
    byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.teamLeague.team.externalId]);
    teamsByLeagueUser.set(row.teamLeague.externalLeagueId, byUser);
  }
  const map = new Map<number, Set<string>>();
  for (const [externalLeagueId, byUser] of teamsByLeagueUser) {
    const pairs = new Set<string>();
    for (const teamIds of byUser.values()) {
      for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) pairs.add(reminderPairKey(teamIds[i], teamIds[j]));
      }
    }
    map.set(externalLeagueId, pairs);
  }
  return map;
}
