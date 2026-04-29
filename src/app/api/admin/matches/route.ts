import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { serializeMatch } from '@/models/Match';
import { processMatchResults } from '@/lib/results-processor';
import { fetchAndInsertMatches, sendNewMatchNotifications } from '@/lib/matches-processor';
import { format, addDays, startOfISOWeek } from 'date-fns';
import { safeParseBody } from '@/lib/request';
import { MatchRepository } from '@/lib/repositories/match-repository';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = 50;

  const [matches, total] = await Promise.all([
    MatchRepository.findMany({ orderBy: { kickoffTime: 'desc' }, skip: (page - 1) * limit, take: limit }),
    MatchRepository.count(),
  ]);

  return NextResponse.json({ matches: matches.map(serializeMatch), total, page });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await safeParseBody<any>(req);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { action, leagueId } = body;

  // ── Create a custom (non-external) match ───────────────────────────────────
  if (action === 'create-custom') {
    const { homeTeamName, awayTeamName, kickoffTime } = body;
    if (!homeTeamName?.trim() || !awayTeamName?.trim() || !kickoffTime) {
      return NextResponse.json({ error: 'homeTeamName, awayTeamName and kickoffTime are required' }, { status: 400 });
    }
    const kickoff = new Date(kickoffTime);
    if (isNaN(kickoff.getTime())) {
      return NextResponse.json({ error: 'Invalid kickoffTime' }, { status: 400 });
    }
    const weekStart = startOfISOWeek(kickoff);
    weekStart.setUTCHours(0, 0, 0, 0);

    const match = await MatchRepository.create({
      data: {
        externalId: null,
        externalLeagueId: 0,
        homeTeamExtId: 0,
        homeTeamName: homeTeamName.trim(),
        awayTeamExtId: 0,
        awayTeamName: awayTeamName.trim(),
        kickoffTime: kickoff,
        weekStart,
        status: 'scheduled',
        scoresProcessed: false,
      },
    });

    // Notify users about the new custom match
    await sendNewMatchNotifications(weekStart, 1, 'admin/create-custom');

    return NextResponse.json({ match: serializeMatch(match) }, { status: 201 });
  }

  // ── Fetch results for past matches without results ─────────────────────────
  if (action === 'fetch-results') {
    const { updated, scored } = await processMatchResults('admin/matches');
    return NextResponse.json({ updated, scored });
  }

  // ── Fetch upcoming fixtures (this week) ─────────────────────────────────────
  if (action !== 'fetch') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  const from = format(weekStart, 'yyyy-MM-dd');
  const to   = format(addDays(weekStart, 7), 'yyyy-MM-dd');

  const { inserted, skipped, debug } = await fetchAndInsertMatches({
    from,
    to,
    weekStart,
    leagueId: leagueId ? Number(leagueId) : undefined,
    filterByTeams: true,
    logPrefix: 'admin/matches fetch',
  });

  return NextResponse.json({ inserted, skipped, debug });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await safeParseBody<any>(req);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No ids provided' }, { status: 400 });

  const numericIds = ids.map((id: string) => Number(id)).filter((id: number) => !isNaN(id));
  const result = await MatchRepository.deleteMany({ where: { id: { in: numericIds } } });
  return NextResponse.json({ deleted: result.count });
}
