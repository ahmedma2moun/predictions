export interface IPrediction {
  id: number;
  userId: number;
  matchId: number;
  homeScore: number;
  awayScore: number;
  predictedWinner: 'home' | 'away' | 'draw';
  pointsAwarded: number;
  scoringBreakdown?: any;
  createdAt: Date;
  updatedAt: Date;
}
