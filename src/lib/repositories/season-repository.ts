import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const SeasonRepository = {
  findMany:  (args: Prisma.SeasonFindManyArgs)   => prisma.season.findMany(args),
  findFirst: (args: Prisma.SeasonFindFirstArgs)  => prisma.season.findFirst(args),
  findUnique:(args: Prisma.SeasonFindUniqueArgs)  => prisma.season.findUnique(args),
  create:    (args: Prisma.SeasonCreateArgs)      => prisma.season.create(args),
  update:    (args: Prisma.SeasonUpdateArgs)      => prisma.season.update(args),
  count:     (args?: Prisma.SeasonCountArgs)      => prisma.season.count(args),
};
