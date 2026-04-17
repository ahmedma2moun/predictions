import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class DeviceTokenRepository {
  static findMany<T extends Prisma.DeviceTokenFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.DeviceTokenFindManyArgs>) {
    return prisma.deviceToken.findMany(args);
  }
  static findUnique<T extends Prisma.DeviceTokenFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenFindUniqueArgs>) {
    return prisma.deviceToken.findUnique(args);
  }
  static create<T extends Prisma.DeviceTokenCreateArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenCreateArgs>) {
    return prisma.deviceToken.create(args);
  }
  static update<T extends Prisma.DeviceTokenUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenUpdateArgs>) {
    return prisma.deviceToken.update(args);
  }
  static delete<T extends Prisma.DeviceTokenDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenDeleteArgs>) {
    return prisma.deviceToken.delete(args);
  }
  static deleteMany<T extends Prisma.DeviceTokenDeleteManyArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenDeleteManyArgs>) {
    return prisma.deviceToken.deleteMany(args);
  }
  static upsert<T extends Prisma.DeviceTokenUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenUpsertArgs>) {
    return prisma.deviceToken.upsert(args);
  }
}
