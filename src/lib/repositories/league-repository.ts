import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class LeagueRepository {
  static findMany<T extends Prisma.LeagueFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.LeagueFindManyArgs>) {
    return prisma.league.findMany(args);
  }
  static findUnique<T extends Prisma.LeagueFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueFindUniqueArgs>) {
    return prisma.league.findUnique(args);
  }
  static create<T extends Prisma.LeagueCreateArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueCreateArgs>) {
    return prisma.league.create(args);
  }
  static update<T extends Prisma.LeagueUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueUpdateArgs>) {
    return prisma.league.update(args);
  }
  static upsert<T extends Prisma.LeagueUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueUpsertArgs>) {
    return prisma.league.upsert(args);
  }
  static delete<T extends Prisma.LeagueDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueDeleteArgs>) {
    return prisma.league.delete(args);
  }
}
