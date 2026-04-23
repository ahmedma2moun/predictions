// Types mirror responses from football-predictions/src/app/api/mobile/*

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

export interface Team {
  name: string;
  logo: string | null;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
}

export interface PredictionSummary {
  homeScore: number;
  awayScore: number;
  predictedWinner: 'home' | 'away' | 'draw' | null;
  pointsAwarded: number;
}

export interface Standing {
  position: number;
  points: number;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goalDifference?: number;
  form?: string | null;
}

export interface MatchListItem {
  _id: string;
  kickoffTime: string;
  status: MatchStatus;
  leagueId: string | null;
  leagueName: string | null;
  matchday: number | null;
  stage: string | null;
  leg: number | null;
  venue: string | null;
  homeTeam: Team;
  awayTeam: Team;
  result: MatchResult | null;
  prediction: PredictionSummary | null;
  homeStanding: { position: number; points: number } | null;
  awayStanding: { position: number; points: number } | null;
}

export interface MatchDetail extends MatchListItem {
  isAdmin: boolean;
  isKnockout: boolean;
  homeStanding: Standing | null;
  awayStanding: Standing | null;
  resultPenaltyHomeScore: number | null;
  resultPenaltyAwayScore: number | null;
  allPredictions: Array<{
    userId: string;
    userName: string;
    homeScore: number;
    awayScore: number;
    pointsAwarded: number;
    scoringBreakdown: Array<{ key: string; name: string; points: number; awarded: boolean }> | null;
  }> | null;
}

export interface H2HMatch {
  date: string;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
  competition: string;
  status: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface ScoringRuleBreakdown {
  key: string;
  name: string;
  points: number;
  awarded: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalPoints: number;
  predictionsCount: number;
  accuracy: number;
  currentStreak: number;
  badges: string[];
}

export interface LeaderboardGroup {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface LeaderboardLeague {
  id: string;
  externalId: number;
  name: string;
  country: string;
  logo: string | null;
}

export interface LeaderboardUserPrediction {
  matchId: string;
  kickoffTime: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  result: { homeScore: number; awayScore: number };
  pointsAwarded: number;
  scoringBreakdown: ScoringRuleBreakdown[] | null;
}

export interface GroupPredictionEntry {
  userId: string;
  userName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  pointsAwarded: number | null;
  scoringBreakdown: ScoringRuleBreakdown[] | null;
  predicted: boolean;
}

export interface AccuracyStats {
  totalPoints: number;
  overallAccuracy: number;
  exactScorePct: number;
  correctWinnerPct: number;
  bestLeagueName: string | null;
  currentStreak: number;
  totalFinished: number;
}

export interface PredictionHistoryItem {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  predictedWinner: 'home' | 'away' | 'draw' | null;
  pointsAwarded: number;
  createdAt: string;
  updatedAt: string;
  scoringBreakdown: ScoringRuleBreakdown[] | null;
  match: {
    _id: string;
    kickoffTime: string;
    status: MatchStatus;
    leagueId: string | null;
    leagueName: string | null;
    matchday: number | null;
    stage: string | null;
    leg: number | null;
    venue: string | null;
    homeTeam: Team;
    awayTeam: Team;
    result: MatchResult | null;
  };
}
