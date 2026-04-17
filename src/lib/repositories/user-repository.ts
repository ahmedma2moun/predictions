import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class UserRepository {
  static findMany<T extends Prisma.UserFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>) {
    return prisma.user.findMany(args);
  }
  static findUnique<T extends Prisma.UserFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>) {
    return prisma.user.findUnique(args);
  }
  static create<T extends Prisma.UserCreateArgs>(args: Prisma.SelectSubset<T, Prisma.UserCreateArgs>) {
    return prisma.user.create(args);
  }
  static update<T extends Prisma.UserUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.UserUpdateArgs>) {
    return prisma.user.update(args);
  }
  static delete<T extends Prisma.UserDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.UserDeleteArgs>) {
    return prisma.user.delete(args);
  }
  static upsert<T extends Prisma.UserUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.UserUpsertArgs>) {
    return prisma.user.upsert(args);
  }
}
