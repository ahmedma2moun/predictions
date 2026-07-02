import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Thin Prisma wrappers for the Champion Bonus aggregate (config, allowed teams,
 * picks, per-team-per-match awards). All business logic lives in
 * `champion-bonus-service.ts`; this file only touches the DB.
 */
export class ChampionBonusRepository {
  // ── Config ──────────────────────────────────────────────────────────────────
  static findConfigBySeasonId<T extends Omit<Prisma.ChampionBonusFindUniqueArgs, 'where'>>(
    seasonId: number,
    args?: Prisma.SelectSubset<T, Omit<Prisma.ChampionBonusFindUniqueArgs, 'where'>>,
  ) {
    return prisma.championBonus.findUnique({ where: { seasonId }, ...(args as object) });
  }

  static findConfigById<T extends Omit<Prisma.ChampionBonusFindUniqueArgs, 'where'>>(
    id: number,
    args?: Prisma.SelectSubset<T, Omit<Prisma.ChampionBonusFindUniqueArgs, 'where'>>,
  ) {
    return prisma.championBonus.findUnique({ where: { id }, ...(args as object) });
  }

  static createConfig<T extends Prisma.ChampionBonusCreateArgs>(args: Prisma.SelectSubset<T, Prisma.ChampionBonusCreateArgs>) {
    return prisma.championBonus.create(args);
  }

  static updateConfig<T extends Prisma.ChampionBonusUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.ChampionBonusUpdateArgs>) {
    return prisma.championBonus.update(args);
  }

  static deleteConfig(id: number) {
    return prisma.championBonus.delete({ where: { id } });
  }

  static findLockedConfigs<T extends Prisma.ChampionBonusFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.ChampionBonusFindManyArgs>) {
    return prisma.championBonus.findMany(args);
  }

  // ── Teams (allowed subset) ────────────────────────────────────────────────────
  static createTeams(championBonusId: number, teamIds: number[]) {
    return prisma.championBonusTeam.createMany({
      data: teamIds.map(teamId => ({ championBonusId, teamId })),
      skipDuplicates: true,
    });
  }

  static deleteTeamsNotIn(championBonusId: number, keepTeamIds: number[]) {
    return prisma.championBonusTeam.deleteMany({
      where: { championBonusId, teamId: { notIn: keepTeamIds.length ? keepTeamIds : [-1] } },
    });
  }

  static findTeams(championBonusId: number) {
    return prisma.championBonusTeam.findMany({
      where: { championBonusId },
      include: { team: true },
    });
  }

  // ── Picks ─────────────────────────────────────────────────────────────────────
  static upsertPick(championBonusId: number, userId: number, teamId: number) {
    return prisma.championBonusPick.upsert({
      where: { championBonusId_userId: { championBonusId, userId } },
      create: { championBonusId, userId, teamId },
      update: { teamId },
    });
  }

  static deletePicksForTeams(championBonusId: number, teamIds: number[]) {
    return prisma.championBonusPick.deleteMany({
      where: { championBonusId, teamId: { in: teamIds.length ? teamIds : [-1] } },
    });
  }

  static findPicks<T extends Prisma.ChampionBonusPickFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.ChampionBonusPickFindManyArgs>) {
    return prisma.championBonusPick.findMany(args);
  }

  static findMyPick(championBonusId: number, userId: number) {
    return prisma.championBonusPick.findUnique({
      where: { championBonusId_userId: { championBonusId, userId } },
    });
  }

  static countPicks(championBonusId: number) {
    return prisma.championBonusPick.count({ where: { championBonusId } });
  }

  // ── Awards (per team, per match) ───────────────────────────────────────────────
  static deleteAwardsForTeam(championBonusId: number, teamId: number) {
    return prisma.championBonusAward.deleteMany({ where: { championBonusId, teamId } });
  }

  static createAwards(
    rows: Array<{ championBonusId: number; teamId: number; matchId: number; gameNumber: number; isWin: boolean; points: number }>,
  ) {
    return prisma.championBonusAward.createMany({ data: rows, skipDuplicates: true });
  }

  static findAwards<T extends Prisma.ChampionBonusAwardFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.ChampionBonusAwardFindManyArgs>) {
    return prisma.championBonusAward.findMany(args);
  }

  /**
   * Per-user bonus totals, joined through the award's match so that the caller's
   * match `whereClause` (league / season / date filters) applies exactly the same
   * way it does for prediction points.
   */
  static getBonusStats(whereClause: Prisma.Sql) {
    return prisma.$queryRaw<Array<{ userId: number; bonus: number }>>(
      Prisma.sql`
        SELECT cbp."userId", SUM(cba.points)::int AS bonus
        FROM "ChampionBonusPick" cbp
        JOIN "ChampionBonusAward" cba
          ON cba."championBonusId" = cbp."championBonusId" AND cba."teamId" = cbp."teamId"
        JOIN "Match" m ON m.id = cba."matchId"
        WHERE ${whereClause}
        GROUP BY cbp."userId"
      `,
    );
  }

  static transaction(promises: Prisma.PrismaPromise<unknown>[]) {
    return prisma.$transaction(promises);
  }
}
