export interface IMatch {
  id: number;
  externalId: number;
  leagueId: number | null;
  externalLeagueId: number;
  homeTeamExtId: number;
  homeTeamName: string;
  homeTeamLogo?: string | null;
  awayTeamExtId: number;
  awayTeamName: string;
  awayTeamLogo?: string | null;
  kickoffTime: Date;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  matchday?: number | null;
  stage?: string | null;
  leg?: number | null;
  venue?: string | null;
  resultHomeScore?: number | null;
  resultAwayScore?: number | null;
  resultPenaltyHomeScore?: number | null;
  resultPenaltyAwayScore?: number | null;
  resultWinner?: 'home' | 'away' | 'draw' | null;
  scoresProcessed: boolean;
  weekStart: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Converts a flat Prisma match row to the flat shape expected by the mobile API. */
export function serializeMatchForMobile(m: IMatch & { leagueName?: string | null }) {
  return {
    id: m.id.toString(),
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    homeTeamLogo: m.homeTeamLogo ?? null,
    awayTeamLogo: m.awayTeamLogo ?? null,
    kickoffTime: m.kickoffTime,
    status: m.status,
    leagueId: m.leagueId?.toString() ?? null,
    leagueName: m.leagueName ?? null,
    matchday: m.matchday ?? null,
    stage: m.stage ?? null,
    leg: m.leg ?? null,
    resultHomeScore: m.resultHomeScore ?? null,
    resultAwayScore: m.resultAwayScore ?? null,
  };
}

/** Converts a flat Prisma match row to the nested shape expected by the frontend. */
export function serializeMatch(m: IMatch) {
  return {
    _id: m.id.toString(),
    externalId: m.externalId,
    leagueId: m.leagueId?.toString() ?? '',
    externalLeagueId: m.externalLeagueId,
    homeTeam: { externalId: m.homeTeamExtId, name: m.homeTeamName, logo: m.homeTeamLogo ?? undefined },
    awayTeam: { externalId: m.awayTeamExtId, name: m.awayTeamName, logo: m.awayTeamLogo ?? undefined },
    kickoffTime: m.kickoffTime,
    status: m.status,
    matchday: m.matchday ?? null,
    stage: m.stage ?? null,
    leg: m.leg ?? null,
    venue: m.venue ?? null,
    result:
      m.resultHomeScore !== null && m.resultHomeScore !== undefined
        ? {
            homeScore: m.resultHomeScore,
            awayScore: m.resultAwayScore!,
            winner: m.resultWinner!,
            penaltyHomeScore: m.resultPenaltyHomeScore ?? null,
            penaltyAwayScore: m.resultPenaltyAwayScore ?? null,
          }
        : undefined,
    scoresProcessed: m.scoresProcessed,
    weekStart: m.weekStart,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}
