import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class TeamStandingRepository {
  static findMany<T extends Prisma.TeamStandingFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.TeamStandingFindManyArgs>) {
    return prisma.teamStanding.findMany(args);
  }

  static groupBy<T extends Prisma.TeamStandingGroupByArgs>(args: Prisma.SelectSubset<T, Prisma.TeamStandingGroupByArgs>) {
    return prisma.teamStanding.groupBy(args as any);
  }

  static executeRaw(query: Prisma.Sql) {
    return prisma.$executeRaw(query);
  }

  static transaction(promises: any[]) {
    return prisma.$transaction(promises);
  }
}
