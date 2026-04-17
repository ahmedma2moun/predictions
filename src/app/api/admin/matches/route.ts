import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serializeMatch } from '@/models/Match';
import { processMatchResults } from '@/lib/results-processor';
import { fetchAndInsertMatches } from '@/lib/matches-processor';
import { format, addDays } from 'date-fns';
import { safeParseBody } from '@/lib/request';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = 50;

  const [matches, total] = await Promise.all([
    prisma.match.findMany({ orderBy: { kickoffTime: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.match.count(),
  ]);

  return NextResponse.json({ matches: matches.map(serializeMatch), total, page });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await safeParseBody<any>(req);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { action, leagueId } = body;

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
  const result = await prisma.match.deleteMany({ where: { id: { in: numericIds } } });
  return NextResponse.json({ deleted: result.count });
}
