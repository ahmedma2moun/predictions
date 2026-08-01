export interface IMatch {
  id: number;
  externalId: number | null;
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

/** Converts a flat Prisma match row to the nested shape expected by the mobile app. */
export function serializeMatchForMobile(m: IMatch & { leagueName?: string | null }) {
  const hasResult = m.resultHomeScore !== null && m.resultHomeScore !== undefined;
  return {
    _id: m.id.toString(),
    externalId: m.externalId,
    kickoffTime: m.kickoffTime,
    status: m.status,
    leagueId: m.leagueId?.toString() ?? null,
    leagueName: m.leagueName ?? null,
    matchday: m.matchday ?? null,
    stage: m.stage ?? null,
    leg: m.leg ?? null,
    venue: m.venue ?? null,
    homeTeam: {
      name: m.homeTeamName,
      logo: m.homeTeamLogo ?? null,
    },
    awayTeam: {
      name: m.awayTeamName,
      logo: m.awayTeamLogo ?? null,
    },
    result: hasResult
      ? {
          homeScore: m.resultHomeScore!,
          awayScore: m.resultAwayScore!,
          penaltyHomeScore: m.resultPenaltyHomeScore ?? null,
          penaltyAwayScore: m.resultPenaltyAwayScore ?? null,
        }
      : null,
  };
}

/** The shape serializeMatch() produces, as it actually arrives client-side after JSON serialization (Dates become ISO strings). */
export interface SerializedMatch {
  _id: string;
  externalId: number | null;
  leagueId: string;
  externalLeagueId: number;
  homeTeam: { externalId: number; name: string; logo?: string };
  awayTeam: { externalId: number; name: string; logo?: string };
  kickoffTime: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  matchday: number | null;
  stage: string | null;
  leg: number | null;
  venue: string | null;
  result?: {
    homeScore: number;
    awayScore: number;
    winner: 'home' | 'away' | 'draw';
    penaltyHomeScore: number | null;
    penaltyAwayScore: number | null;
  };
  scoresProcessed: boolean;
  weekStart: string;
  createdAt: string;
  updatedAt: string;
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
