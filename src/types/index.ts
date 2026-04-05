export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export interface MatchWithPrediction {
  _id: string;
  externalId: number;
  leagueId: string;
  externalLeagueId: number;
  homeTeam: { externalId: number; name: string; logo?: string };
  awayTeam: { externalId: number; name: string; logo?: string };
  kickoffTime: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  result?: { homeScore: number; awayScore: number; winner: 'home' | 'away' | 'draw' };
  scoresProcessed: boolean;
  weekStart: string;
  prediction?: {
    homeScore: number;
    awayScore: number;
    pointsAwarded: number;
    predictedWinner: string;
  };
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  totalPoints: number;
  predictionsCount: number;
  correctPredictions: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
