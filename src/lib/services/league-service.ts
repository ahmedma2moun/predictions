import { prisma } from '@/lib/prisma';

export interface LeagueItem {
  id: string;
  externalId: number;
  name: string;
  country: string | null;
  logo: string | null;
}

export async function getActiveLeagues(): Promise<LeagueItem[]> {
  const leagues = await prisma.league.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, externalId: true, name: true, country: true, logo: true },
  });
  return leagues.map(l => ({ ...l, id: l.id.toString() }));
}
