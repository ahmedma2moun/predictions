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

export type RuleRow = { key?: string; ruleId?: number; ruleName: string; pointsAwarded: number; matched: boolean };
export type BreakdownItem = { key: string; name: string; points: number; awarded: boolean };

export function serializeBreakdown(raw: unknown): BreakdownItem[] | null {
  return ((raw as { rules?: RuleRow[] } | null)?.rules ?? null)
    ?.map(r => ({ key: r.key ?? String(r.ruleId ?? ''), name: r.ruleName, points: r.pointsAwarded, awarded: r.matched })) ?? null;
}
