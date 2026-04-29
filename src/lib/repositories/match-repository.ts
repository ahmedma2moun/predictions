import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class MatchRepository {
  static findUnique<T extends Prisma.MatchFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.MatchFindUniqueArgs>) {
    return prisma.match.findUnique(args);
  }

  static findById<T extends Omit<Prisma.MatchFindUniqueArgs, 'where'>>(id: number, args?: Prisma.SelectSubset<T, Omit<Prisma.MatchFindUniqueArgs, 'where'>>) {
    return prisma.match.findUnique({ where: { id }, ...(args as any) });
  }

  static findMany<T extends Prisma.MatchFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.MatchFindManyArgs>) {
    return prisma.match.findMany(args);
  }

  static update<T extends Prisma.MatchUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.MatchUpdateArgs>) {
    return prisma.match.update(args);
  }

  static updateMany<T extends Prisma.MatchUpdateManyArgs>(args: Prisma.SelectSubset<T, Prisma.MatchUpdateManyArgs>) {
    return prisma.match.updateMany(args);
  }

  static transaction(promises: any[]) {
    return prisma.$transaction(promises);
  }

  static create<T extends Prisma.MatchCreateArgs>(args: Prisma.SelectSubset<T, Prisma.MatchCreateArgs>) {
    return prisma.match.create(args);
  }

  static createMany<T extends Prisma.MatchCreateManyArgs>(args: Prisma.SelectSubset<T, Prisma.MatchCreateManyArgs>) {
    return prisma.match.createMany(args);
  }

  static deleteMany<T extends Prisma.MatchDeleteManyArgs>(args: Prisma.SelectSubset<T, Prisma.MatchDeleteManyArgs>) {
    return prisma.match.deleteMany(args);
  }

  static count<T extends Prisma.MatchCountArgs>(args?: Prisma.SelectSubset<T, Prisma.MatchCountArgs>) {
    return prisma.match.count(args);
  }
}
