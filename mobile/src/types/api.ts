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
  externalId: number | null;
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
  odds: MatchOdds | null;
  allPredictions: Array<{
    userId: string;
    userName: string;
    homeScore: number;
    awayScore: number;
    pointsAwarded: number;
    scoringBreakdown: Array<{ key: string; name: string; points: number; awarded: boolean }> | null;
    oddsBonus: OddsBonus | null;
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

export interface MatchEvent {
  type: 'goal' | 'card';
  detail: string;
  minute: number;
  team: 'home' | 'away';
  player: string;
  assistPlayer: string | null;
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

export interface OddsBonus {
  outcomeOdds: number;
  baseScore: number;
  finalScore: number;
}

export interface MatchOddsFactors {
  homeWin: number;
  draw: number;
  awayWin: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalPoints: number;
  championBonusPoints: number;
  predictionsCount: number;
  accuracy: number;
  currentStreak: number;
  longestStreak: number;
  badges: string[];
  exactScoreCount: number;
  isGroupChampion: boolean;
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
  oddsBonus: OddsBonus | null;
  matchOdds: MatchOddsFactors | null;
}

export interface GroupPredictionEntry {
  userId: string;
  userName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  pointsAwarded: number | null;
  scoringBreakdown: ScoringRuleBreakdown[] | null;
  predicted: boolean;
  isLive: boolean;
}

export interface AccuracyStats {
  totalPoints: number;
  overallAccuracy: number;
  exactScorePct: number;
  correctWinnerPct: number;
  bestLeagueName: string | null;
  bestLeagueLogo: string | null;
  currentStreak: number;
  totalFinished: number;
}

export interface Season {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface SeasonStandingEntry {
  id: string;
  rank: number;
  totalPoints: number;
  groupId: number | null;
  groupName: string | null;
  userId: string;
  userName: string | null;
}

export interface SeasonWithStandings extends Season {
  standings: SeasonStandingEntry[];
}

export interface MatchOdds {
  homeWin: number;
  draw: number;
  awayWin: number;
  locked: boolean;
  votes: { homeWin: number; draw: number; awayWin: number };
}

export interface PredictionHistoryItem {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  predictedWinner: 'home' | 'away' | 'draw' | null;
  pointsAwarded: number;
  baseScore: number;
  outcomeOdds: number;
  createdAt: string;
  updatedAt: string;
  scoringBreakdown: ScoringRuleBreakdown[] | null;
  oddsBonus: OddsBonus | null;
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
    odds?: MatchOdds | null;
  };
}

// ── Live Group Standing ───────────────────────────────────────────────────────

export type LiveMovement = 'up' | 'down' | 'same';

export interface LiveStandingMatch {
  matchId: string;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
  homeScore: number;
  awayScore: number;
  status: 'live' | 'finished';
  kickoffTime: string;
}

export interface LiveStandingEntry {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  previousRank: number;
  rank: number;
  movement: LiveMovement;
  points: number;
  livePoints: number;
  liveTotalPoints: number;
}

export interface LiveGroupStanding {
  hasLiveMatches: boolean;
  matches: LiveStandingMatch[];
  standings: LiveStandingEntry[];
}

// ── Champion Bonus ────────────────────────────────────────────────────────────

export interface ChampionBonusAllowedTeam {
  teamId: string;
  name: string;
  logo: string | null;
}

export interface ChampionBonusAwardTile {
  matchId: string;
  gameNumber: number;
  opponentName: string;
  homeAway: 'home' | 'away';
  teamScore: number | null;
  opponentScore: number | null;
  kickoffTime: string;
  isWin: boolean;
  points: number;
}

export interface ChampionBonusRevealTeam {
  teamId: string;
  name: string;
  logo: string | null;
  awards: ChampionBonusAwardTile[];
  totalPoints: number;
  nextWinPoints: number;
}

export interface ChampionBonusRevealPick {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  totalBonus: number;
}

export type ChampionBonusState =
  | { enabled: false }
  | {
      enabled: true;
      status: 'OPEN';
      league: { id: string; name: string; logo: string | null };
      allowedTeams: ChampionBonusAllowedTeam[];
      pickCount: number;
      myPick: { teamId: string } | null;
    }
  | {
      enabled: true;
      status: 'LOCKED';
      league: { id: string; name: string; logo: string | null };
      lockedAt: string;
      myPick: { teamId: string } | null;
      teams: Record<string, ChampionBonusRevealTeam>;
      picks: ChampionBonusRevealPick[];
    };
