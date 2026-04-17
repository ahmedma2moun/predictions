import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class GroupRepository {
  static findMany<T extends Prisma.GroupFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.GroupFindManyArgs>) {
    return prisma.group.findMany(args);
  }
  static findUnique<T extends Prisma.GroupFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.GroupFindUniqueArgs>) {
    return prisma.group.findUnique(args);
  }
  static create<T extends Prisma.GroupCreateArgs>(args: Prisma.SelectSubset<T, Prisma.GroupCreateArgs>) {
    return prisma.group.create(args);
  }
  static update<T extends Prisma.GroupUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.GroupUpdateArgs>) {
    return prisma.group.update(args);
  }
  static delete<T extends Prisma.GroupDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.GroupDeleteArgs>) {
    return prisma.group.delete(args);
  }
  
  static async findDefaultGroup() {
    return prisma.group.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
  }

  static async findAllWithMemberCount() {
    return prisma.group.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { members: true } } },
    });
  }

  static async findAllNames() {
    return prisma.group.findMany({
      select: { id: true, name: true, isDefault: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  static async findByIdWithMembers(id: number) {
    return prisma.group.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      },
    });
  }

  static async findExistence(id: number) {
    return prisma.group.findUnique({
      where: { id },
      select: { id: true, isDefault: true },
    });
  }

  static async addMember(groupId: number, userId: number) {
    return prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId },
      update: {},
    });
  }

  static async removeMember(groupId: number, userId: number) {
    return prisma.groupMember.deleteMany({
      where: { groupId, userId },
    });
  }

  static async findMembershipsByUserId(userId: number) {
    return prisma.groupMember.findMany({
      where: { userId },
      include: { group: { select: { id: true, name: true, isDefault: true } } },
      orderBy: { group: { isDefault: 'desc' } },
    });
  }
}
