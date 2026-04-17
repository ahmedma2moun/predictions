import { DeviceTokenRepository } from '@/lib/repositories/device-repository';
import { Prisma } from '@prisma/client';

export class DeviceTokenService {
  static getAll<T extends Prisma.DeviceTokenFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.DeviceTokenFindManyArgs>) {
    return DeviceTokenRepository.findMany(args);
  }
  static getById<T extends Prisma.DeviceTokenFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenFindUniqueArgs>) {
    return DeviceTokenRepository.findUnique(args);
  }
  static create<T extends Prisma.DeviceTokenCreateArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenCreateArgs>) {
    return DeviceTokenRepository.create(args);
  }
  static update<T extends Prisma.DeviceTokenUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenUpdateArgs>) {
    return DeviceTokenRepository.update(args);
  }
  static remove<T extends Prisma.DeviceTokenDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenDeleteArgs>) {
    return DeviceTokenRepository.delete(args);
  }
  static removeMany<T extends Prisma.DeviceTokenDeleteManyArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenDeleteManyArgs>) {
    return DeviceTokenRepository.deleteMany(args);
  }
  static upsert<T extends Prisma.DeviceTokenUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.DeviceTokenUpsertArgs>) {
    return DeviceTokenRepository.upsert(args);
  }
}
