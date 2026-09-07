export type GamePlayer = { id: number; name: string; title: string | null };
export type GamePrediction = { userId: number; homeScore: number; awayScore: number; pointsAwarded: number };
export type GameMatch = {
  id: number; homeTeamName: string; awayTeamName: string; kickoffTime: string;
  status: string; scoresProcessed: boolean; resultHomeScore: number | null; resultAwayScore: number | null;
  predictions: GamePrediction[];
};
export type WeekRow = { userId: number; name: string; points: number; exact: number; predicted: number; rank: number; title: string | null };
export type WeekCompetition = {
  key: string; end: string; state: 'open' | 'awaiting_results' | 'complete'; matchCount: number;
  standings: WeekRow[]; winnerIds: number[];
};
export type GameEvent = {
  key: string; at: string; kind: 'exact' | 'weekly_win' | 'lead'; text: string; matchId: number | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
};
export type Challenge = { key: string; name: string; description: string; title: string; progress: number; target: number; unlocked: boolean };
export type PlayerRecap = {
  name: string; seasonName: string; final: boolean; rank: number | null; totalPoints: number;
  predictions: number; exactScores: number; accuracy: number; longestStreak: number;
  weeklyWins: number; biggestComeback: number; bestPrediction: { matchId: number; label: string; score: string; points: number } | null;
  shareText: string;
};
export type GameHub = {
  currentWeekKey: string; userId: number; groups: { id: number; name: string }[]; groupId: number | null;
  seasons: { id: number; name: string; status: string }[]; seasonId: number | null;
  players: GamePlayer[]; weeks: WeekCompetition[]; feed: GameEvent[]; challenges: Challenge[];
  equippedTitle: string | null; unlockedTitles: { key: string; title: string }[];
  rival: { userId: number; name: string; myPoints: number; theirPoints: number; gap: number; wins: number; losses: number; draws: number; myAccuracy: number; theirAccuracy: number } | null;
  recap: PlayerRecap | null;
};
export type SlipMatch = { id: number; homeTeamName: string; awayTeamName: string; kickoffTime: string; league: string; homeScore: number | null; awayScore: number | null; locked: boolean };
export type SlipData = { matches: SlipMatch[]; remaining: number; from: string; to: string };
export type SlipResult = { matchId: number; saved: boolean; error?: string };
