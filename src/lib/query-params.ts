import type { NextRequest } from 'next/server';

export interface LeaderboardQuery {
  leagueIds: number[];
  groupId?: number;
  from?: string;
  to?: string;
}

export function parseLeaderboardQuery(req: NextRequest): LeaderboardQuery {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');
  return {
    leagueIds: searchParams.getAll('leagueId').map(Number).filter(Boolean),
    groupId: groupId ? Number(groupId) : undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
  };
}
