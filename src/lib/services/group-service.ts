import { GroupRepository } from '@/lib/repositories/group-repository';

export interface GroupItem {
  id: string;
  name: string;
  isDefault: boolean;
}

export class GroupService {
  static async getUserGroups(userId: number, isAdmin: boolean): Promise<GroupItem[]> {
    if (isAdmin) {
      const allGroups = await GroupRepository.findAllNames();
      return allGroups.map(g => ({ id: g.id.toString(), name: g.name, isDefault: g.isDefault }));
    }

    const memberships = await GroupRepository.findMembershipsByUserId(userId);
    return memberships.map(m => ({
      id:        m.group.id.toString(),
      name:      m.group.name,
      isDefault: m.group.isDefault,
    }));
  }

  static async getAllGroupsWithCounts() {
    return GroupRepository.findAllWithMemberCount();
  }

  static async createGroup(name: string) {
    return GroupRepository.create({ data: { name } });
  }

  static async getGroupDetails(id: number) {
    return GroupRepository.findByIdWithMembers(id);
  }

  static async getGroupExistence(id: number) {
    return GroupRepository.findExistence(id);
  }

  static async updateGroupName(id: number, name: string) {
    return GroupRepository.update({ where: { id }, data: { name } });
  }

  static async addGroupMember(groupId: number, userId: number) {
    return GroupRepository.addMember(groupId, userId);
  }

  static async removeGroupMember(groupId: number, userId: number) {
    return GroupRepository.removeMember(groupId, userId);
  }

  static async deleteGroup(id: number) {
    return GroupRepository.delete({ where: { id } });
  }
}

export const getUserGroups = GroupService.getUserGroups;
