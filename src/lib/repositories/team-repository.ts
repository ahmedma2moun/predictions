import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class TeamRepository {
  static findMany<T extends Prisma.TeamFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.TeamFindManyArgs>) {
    return prisma.team.findMany(args);
  }
  static findUnique<T extends Prisma.TeamFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.TeamFindUniqueArgs>) {
    return prisma.team.findUnique(args);
  }
  static create<T extends Prisma.TeamCreateArgs>(args: Prisma.SelectSubset<T, Prisma.TeamCreateArgs>) {
    return prisma.team.create(args);
  }
  static update<T extends Prisma.TeamUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.TeamUpdateArgs>) {
    return prisma.team.update(args);
  }
  static upsert<T extends Prisma.TeamUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.TeamUpsertArgs>) {
    return prisma.team.upsert(args);
  }
  static delete<T extends Prisma.TeamDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.TeamDeleteArgs>) {
    return prisma.team.delete(args);
  }
}
