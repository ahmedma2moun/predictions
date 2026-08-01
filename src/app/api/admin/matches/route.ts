import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { serializeMatch } from '@/models/Match';
import { processMatchResults } from '@/lib/results-processor';
import {
  createCustomMatch,
  fetchThisWeekFixtures,
  fetchNextMonthFixtures,
} from '@/lib/matches-processor';
import { safeParseBody } from '@/lib/request';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { getAdminMatches } from '@/lib/services/match-service';
import { withErrorHandling } from '@/lib/api-handler';
import { requireOneOf } from '@/lib/validation';

const MATCH_ACTIONS = ['create-custom', 'fetch-results', 'fetch-next-month', 'fetch'] as const;

interface MatchActionBody {
  action: unknown;
  leagueId: unknown;
  homeTeamName: unknown;
  awayTeamName: unknown;
  kickoffTime: unknown;
}

interface DeleteMatchesBody {
  ids?: unknown;
}

export const GET = withErrorHandling('admin/matches GET', async (req: NextRequest) => {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = 50;

  const { items, total } = await getAdminMatches(page, limit);

  const serialized = items.map(({ match, odds }) => ({
    ...serializeMatch(match),
    odds,
  }));

  return NextResponse.json({ matches: serialized, total, page });
});

export const POST = withErrorHandling('admin/matches POST', async (req: NextRequest) => {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await safeParseBody<MatchActionBody>(req);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const action = requireOneOf(body.action, MATCH_ACTIONS, 'action');
  const leagueId = body.leagueId ? Number(body.leagueId) : undefined;

  switch (action) {
    case 'create-custom': {
      const match = await createCustomMatch(body);
      return NextResponse.json({ match: serializeMatch(match) }, { status: 201 });
    }
    case 'fetch-results': {
      const { updated, scored } = await processMatchResults('admin/matches');
      return NextResponse.json({ updated, scored });
    }
    // Next calendar month's fixtures — the pre-season / early-window equivalent of 'fetch'.
    case 'fetch-next-month': {
      const { inserted, skipped, debug } = await fetchNextMonthFixtures(leagueId);
      return NextResponse.json({ inserted, skipped, debug });
    }
    case 'fetch': {
      const { inserted, skipped, debug } = await fetchThisWeekFixtures(leagueId);
      return NextResponse.json({ inserted, skipped, debug });
    }
  }
});

export const DELETE = withErrorHandling('admin/matches DELETE', async (req: NextRequest) => {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await safeParseBody<DeleteMatchesBody>(req);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No ids provided' }, { status: 400 });

  const numericIds = ids.map((id: unknown) => Number(id)).filter((id: number) => !isNaN(id));
  const result = await MatchRepository.deleteMany({ where: { id: { in: numericIds } } });
  return NextResponse.json({ deleted: result.count });
});
