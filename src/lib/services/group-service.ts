import { prisma } from '@/lib/prisma';

export interface GroupItem {
  id: string;
  name: string;
  isDefault: boolean;
}

export async function getUserGroups(userId: number, isAdmin: boolean): Promise<GroupItem[]> {
  if (isAdmin) {
    const allGroups = await prisma.group.findMany({
      select: { id: true, name: true, isDefault: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return allGroups.map(g => ({ id: g.id.toString(), name: g.name, isDefault: g.isDefault }));
  }

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: { select: { id: true, name: true, isDefault: true } } },
    orderBy: { group: { isDefault: 'desc' } },
  });

  return memberships.map(m => ({
    id:        m.group.id.toString(),
    name:      m.group.name,
    isDefault: m.group.isDefault,
  }));
}
