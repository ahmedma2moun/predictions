import { TeamRepository } from '@/lib/repositories/team-repository';
import { TeamLeagueRepository } from '@/lib/repositories/team-league-repository';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class TeamService {
  static getAll<T extends Prisma.TeamFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.TeamFindManyArgs>) {
    return TeamRepository.findMany(args);
  }
  static getById<T extends Prisma.TeamFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.TeamFindUniqueArgs>) {
    return TeamRepository.findUnique(args);
  }

  static async getByLeagueId(leagueId: number) {
    const teamLeagues = await TeamLeagueRepository.findMany({
      where: { leagueId },
      include: { team: true },
      orderBy: { team: { name: 'asc' } },
    });
    return teamLeagues.map(tl => ({
      ...tl.team,
      leagueId: tl.leagueId,
      externalLeagueId: tl.externalLeagueId,
      isActive: tl.isActive,
    }));
  }

  static async syncTeamWithLeague(params: {
    externalId: number;
    name: string;
    logo?: string | null;
    leagueId: number;
    externalLeagueId: number;
  }) {
    const team = await TeamRepository.upsert({
      where: { externalId: params.externalId },
      create: { externalId: params.externalId, name: params.name, logo: params.logo },
      update: { name: params.name, logo: params.logo },
    });
    const teamLeague = await TeamLeagueRepository.upsert({
      where: { teamId_leagueId: { teamId: team.id, leagueId: params.leagueId } },
      create: {
        teamId: team.id,
        leagueId: params.leagueId,
        externalLeagueId: params.externalLeagueId,
        isActive: true,
      },
      update: { externalLeagueId: params.externalLeagueId, isActive: true },
    });
    return { team, teamLeague };
  }

  static async removeFromLeague(teamExternalId: number, leagueId: number) {
    const team = await TeamRepository.findUnique({ where: { externalId: teamExternalId } });
    if (!team) return;
    await TeamLeagueRepository.delete({
      where: { teamId_leagueId: { teamId: team.id, leagueId } },
    }).catch(() => null);
  }

  static async deleteOrphansForLeague(leagueId: number) {
    const linked = await TeamLeagueRepository.findMany({
      where: { leagueId },
      select: { teamId: true },
    });
    const linkedIds = linked.map(r => r.teamId);
    if (!linkedIds.length) return;

    const counts = await prisma.teamLeague.groupBy({
      by: ['teamId'],
      where: { teamId: { in: linkedIds } },
      _count: { teamId: true },
    });
    const orphanIds = counts.filter(c => c._count.teamId === 1).map(c => c.teamId);
    if (orphanIds.length) {
      await prisma.team.deleteMany({ where: { id: { in: orphanIds } } });
    }
  }

  static async getActiveTeamsByLeagueMap(): Promise<Map<number, Set<number>>> {
    const teamLeagues = await TeamLeagueRepository.findMany({
      where: { isActive: true },
      select: {
        externalLeagueId: true,
        team: { select: { externalId: true } },
      },
    });
    const map = new Map<number, Set<number>>();
    for (const tl of teamLeagues) {
      if (!map.has(tl.externalLeagueId)) map.set(tl.externalLeagueId, new Set());
      map.get(tl.externalLeagueId)!.add(tl.team.externalId);
    }
    return map;
  }
}
