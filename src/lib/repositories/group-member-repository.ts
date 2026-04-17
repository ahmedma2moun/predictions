import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class GroupMemberRepository {
  static findMany<T extends Prisma.GroupMemberFindManyArgs>(args: Prisma.SelectSubset<T, Prisma.GroupMemberFindManyArgs>) {
    return prisma.groupMember.findMany(args);
  }

  static findUnique<T extends Prisma.GroupMemberFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.GroupMemberFindUniqueArgs>) {
    return prisma.groupMember.findUnique(args);
  }

  static upsert<T extends Prisma.GroupMemberUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.GroupMemberUpsertArgs>) {
    return prisma.groupMember.upsert(args);
  }

  static deleteMany<T extends Prisma.GroupMemberDeleteManyArgs>(args: Prisma.SelectSubset<T, Prisma.GroupMemberDeleteManyArgs>) {
    return prisma.groupMember.deleteMany(args);
  }
}
