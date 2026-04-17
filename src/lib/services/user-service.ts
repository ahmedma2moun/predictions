import { UserRepository } from '@/lib/repositories/user-repository';
import { GroupRepository } from '@/lib/repositories/group-repository';
import { Prisma } from '@prisma/client';

export class UserService {
  static getAll<T extends Prisma.UserFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>) {
    return UserRepository.findMany(args);
  }
  static getById<T extends Prisma.UserFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>) {
    return UserRepository.findUnique(args);
  }
  static getByEmail(email: string) {
    return UserRepository.findUnique({ where: { email } });
  }
  static create<T extends Prisma.UserCreateArgs>(args: Prisma.SelectSubset<T, Prisma.UserCreateArgs>) {
    return UserRepository.create(args);
  }
  static update<T extends Prisma.UserUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.UserUpdateArgs>) {
    return UserRepository.update(args);
  }
  static remove<T extends Prisma.UserDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.UserDeleteArgs>) {
    return UserRepository.delete(args);
  }
  static upsert<T extends Prisma.UserUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.UserUpsertArgs>) {
    return UserRepository.upsert(args);
  }

  // Backwards compatibility for existing specific logic
  static async getAllUsers() {
    return UserRepository.findMany({
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, notificationEmail: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async checkEmailExists(email: string) {
    const existing = await UserRepository.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!existing;
  }

  static async createUser(data: Prisma.UserCreateInput) {
    const user = await UserRepository.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
      }
    });

    const defaultGroup = await GroupRepository.findDefaultGroup();
    if (defaultGroup) {
      await GroupRepository.addMember(defaultGroup.id, user.id);
    }

    return user;
  }

  static async updateUser(id: number, data: Prisma.UserUpdateInput) {
    return UserRepository.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, notificationEmail: true, createdAt: true, updatedAt: true },
    });
  }
}
