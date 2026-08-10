import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class TeamLeagueRepository {
  static findMany<T extends Prisma.TeamLeagueFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.TeamLeagueFindManyArgs>) {
    return prisma.teamLeague.findMany(args);
  }
  static upsert<T extends Prisma.TeamLeagueUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.TeamLeagueUpsertArgs>) {
    return prisma.teamLeague.upsert(args);
  }
  static update<T extends Prisma.TeamLeagueUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.TeamLeagueUpdateArgs>) {
    return prisma.teamLeague.update(args);
  }
  static updateMany<T extends Prisma.TeamLeagueUpdateManyArgs>(args: Prisma.SelectSubset<T, Prisma.TeamLeagueUpdateManyArgs>) {
    return prisma.teamLeague.updateMany(args);
  }
  static delete<T extends Prisma.TeamLeagueDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.TeamLeagueDeleteArgs>) {
    return prisma.teamLeague.delete(args);
  }
  static deleteMany<T extends Prisma.TeamLeagueDeleteManyArgs>(args?: Prisma.SelectSubset<T, Prisma.TeamLeagueDeleteManyArgs>) {
    return prisma.teamLeague.deleteMany(args);
  }
}
