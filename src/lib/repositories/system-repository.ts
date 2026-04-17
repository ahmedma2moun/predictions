import { prisma } from '@/lib/prisma';

export class SystemRepository {
  static queryRawUnsafe<T>(query: string, ...values: any[]) {
    return prisma.$queryRawUnsafe<T>(query, ...values);
  }
}
