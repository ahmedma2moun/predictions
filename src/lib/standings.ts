import { prisma } from '@/lib/prisma';
import { fetchStandings } from '@/lib/football-api';

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export type CachedStanding = {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDifference: number;
  form: string | null;
};

/**
 * Composite key used in the standings map: "<teamId>_<leagueId>".
 * A team can appear in multiple competitions so we must scope each standing
 * to its competition — keying by teamId alone would cause collisions.
 */
export function standingKey(externalTeamId: number, externalLeagueId: number): string {
  return `${externalTeamId}_${externalLeagueId}`;
}

/**
 * Returns a map keyed by standingKey(teamId, leagueId) → standing.
 * Standings are fetched from football-data.org on the first call (or when
 * the cache is older than 2 hours) and persisted in TeamStanding for reuse.
 */
export async function getStandingsMap(
  leagues: { externalLeagueId: number; season: number }[],
  { force = false }: { force?: boolean } = {}
): Promise<Map<string, CachedStanding>> {
  const uniqueLeagues = [
    ...new Map(leagues.map(l => [l.externalLeagueId, l])).values(),
  ];

  const now = Date.now();
  const result = new Map<string, CachedStanding>();

  for (const { externalLeagueId } of uniqueLeagues) {
    // Check freshness of the cached data for this league
    const newest = await prisma.teamStanding.findFirst({
      where: { externalLeagueId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    const isStale = force || !newest || now - newest.updatedAt.getTime() > CACHE_TTL_MS;

    if (isStale) {
      try {
        const { season, standings } = await fetchStandings(externalLeagueId);
        for (const entry of standings) {
          await prisma.teamStanding.upsert({
            where: {
              externalTeamId_externalLeagueId: {
                externalTeamId: entry.teamId,
                externalLeagueId,
              },
            },
            update: {
              season,
              position: entry.position,
              played: entry.played,
              won: entry.won,
              drawn: entry.drawn,
              lost: entry.lost,
              points: entry.points,
              goalsFor: entry.goalsFor,
              goalsAgainst: entry.goalsAgainst,
              goalDifference: entry.goalDifference,
              form: entry.form ?? null,
            },
            create: {
              externalTeamId: entry.teamId,
              externalLeagueId,
              season,
              position: entry.position,
              played: entry.played,
              won: entry.won,
              drawn: entry.drawn,
              lost: entry.lost,
              points: entry.points,
              goalsFor: entry.goalsFor,
              goalsAgainst: entry.goalsAgainst,
              goalDifference: entry.goalDifference,
              form: entry.form ?? null,
            },
          });
        }
      } catch (e) {
        console.error(`[standings] Failed to fetch standings for league ${externalLeagueId}:`, e);
        // Fall through — will return whatever is already cached below
      }
    }

    // Load from DB (fresh or cached)
    const rows = await prisma.teamStanding.findMany({ where: { externalLeagueId } });
    for (const row of rows) {
      result.set(standingKey(row.externalTeamId, row.externalLeagueId), {
        position: row.position,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        points: row.points,
        goalDifference: row.goalDifference,
        form: row.form,
      });
    }
  }

  return result;
}
