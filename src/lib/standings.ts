import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { fetchStandings } from '@/lib/football/service';

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
 *
 * Optimizations vs previous version:
 * - Single `groupBy` query to check freshness for ALL leagues at once (was N findFirst queries)
 * - Single bulk `INSERT … ON CONFLICT DO UPDATE` to refresh stale leagues (was N upserts)
 * - Single `findMany` with `IN` to load all league standings at once (was N findMany queries)
 */
export async function getStandingsMap(
  leagues: { externalLeagueId: number; season: number }[],
  { force = false }: { force?: boolean } = {}
): Promise<Map<string, CachedStanding>> {
  const uniqueLeagues = [
    ...new Map(leagues.map(l => [l.externalLeagueId, l])).values(),
  ];
  if (uniqueLeagues.length === 0) return new Map();

  const leagueExternalIds = uniqueLeagues.map(l => l.externalLeagueId);
  const now = Date.now();

  // One query to get the latest updatedAt per league (replaces N findFirst queries)
  const freshnessRows = await prisma.teamStanding.groupBy({
    by: ['externalLeagueId'],
    where: { externalLeagueId: { in: leagueExternalIds } },
    _max: { updatedAt: true },
  });
  const freshnessMap = new Map(freshnessRows.map(r => [r.externalLeagueId, r._max.updatedAt]));

  // Refresh stale leagues
  for (const { externalLeagueId } of uniqueLeagues) {
    const latest  = freshnessMap.get(externalLeagueId);
    const isStale = force || !latest || now - latest.getTime() > CACHE_TTL_MS;
    if (!isStale) continue;

    try {
      const { season, standings } = await fetchStandings(externalLeagueId);
      if (standings.length === 0) continue;

      // Bulk upsert — one statement instead of N individual upserts
      const valuesSql = Prisma.join(
        standings.map(e => Prisma.sql`(
          ${e.teamId}, ${externalLeagueId}, ${season},
          ${e.position}, ${e.played}, ${e.won}, ${e.drawn}, ${e.lost},
          ${e.points}, ${e.goalsFor}, ${e.goalsAgainst}, ${e.goalDifference},
          ${e.form ?? null}, NOW()
        )`)
      );

      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "TeamStanding" (
          "externalTeamId", "externalLeagueId", "season",
          "position", "played", "won", "drawn", "lost",
          "points", "goalsFor", "goalsAgainst", "goalDifference",
          "form", "updatedAt"
        )
        VALUES ${valuesSql}
        ON CONFLICT ("externalTeamId", "externalLeagueId") DO UPDATE SET
          "season"         = EXCLUDED."season",
          "position"       = EXCLUDED."position",
          "played"         = EXCLUDED."played",
          "won"            = EXCLUDED."won",
          "drawn"          = EXCLUDED."drawn",
          "lost"           = EXCLUDED."lost",
          "points"         = EXCLUDED."points",
          "goalsFor"       = EXCLUDED."goalsFor",
          "goalsAgainst"   = EXCLUDED."goalsAgainst",
          "goalDifference" = EXCLUDED."goalDifference",
          "form"           = EXCLUDED."form",
          "updatedAt"      = NOW()
      `);
    } catch (e) {
      console.error(`[standings] Failed to fetch standings for league ${externalLeagueId}:`, e);
      // Fall through — return whatever is already cached below
    }
  }

  // Load all leagues in a single query (replaces N findMany queries)
  const rows = await prisma.teamStanding.findMany({
    where: { externalLeagueId: { in: leagueExternalIds } },
  });

  const result = new Map<string, CachedStanding>();
  for (const row of rows) {
    result.set(standingKey(row.externalTeamId, row.externalLeagueId), {
      position: row.position,
      played:   row.played,
      won:      row.won,
      drawn:    row.drawn,
      lost:     row.lost,
      points:   row.points,
      goalDifference: row.goalDifference,
      form:     row.form,
    });
  }
  return result;
}
