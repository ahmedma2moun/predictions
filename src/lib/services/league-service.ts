import { LeagueRepository } from '@/lib/repositories/league-repository';
import { Prisma } from '@prisma/client';

export class LeagueService {
  static getAll<T extends Prisma.LeagueFindManyArgs>(args?: Prisma.SelectSubset<T, Prisma.LeagueFindManyArgs>) {
    return LeagueRepository.findMany(args);
  }
  static getById<T extends Prisma.LeagueFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueFindUniqueArgs>) {
    return LeagueRepository.findUnique(args);
  }
  static create<T extends Prisma.LeagueCreateArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueCreateArgs>) {
    return LeagueRepository.create(args);
  }
  static update<T extends Prisma.LeagueUpdateArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueUpdateArgs>) {
    return LeagueRepository.update(args);
  }
  static remove<T extends Prisma.LeagueDeleteArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueDeleteArgs>) {
    return LeagueRepository.delete(args);
  }
  static upsert<T extends Prisma.LeagueUpsertArgs>(args: Prisma.SelectSubset<T, Prisma.LeagueUpsertArgs>) {
    return LeagueRepository.upsert(args);
  }
}

export interface LeagueItem {
  id: string;
  externalId: number;
  name: string;
  country: string | null;
  logo: string | null;
}

export async function getActiveLeagues(): Promise<LeagueItem[]> {
  const leagues = await LeagueRepository.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, externalId: true, name: true, country: true, logo: true },
  });
  return leagues.map(l => ({ ...l, id: l.id.toString() }));
}
