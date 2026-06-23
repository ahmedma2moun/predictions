import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { serializeMatch } from '@/models/Match';
import { processMatchResults } from '@/lib/results-processor';
import { fetchAndInsertMatches } from '@/lib/matches-processor';
import { format, addDays, startOfISOWeek } from 'date-fns';
import { safeParseBody } from '@/lib/request';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { DeviceTokenRepository } from '@/lib/repositories/device-repository';
import { sendNewMatchesEmail, type MatchForEmail } from '@/lib/email';
import { sendPushToUsers } from '@/lib/fcm';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { calcMatchOdds, deriveOutcome, ODDS_MIN_DEFAULT, ODDS_MAX_DEFAULT } from '@/lib/odds';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = 50;

  const [matches, total] = await Promise.all([
    MatchRepository.findMany({
      orderBy: { kickoffTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        season: { select: { oddsEnabled: true, oddsMin: true, oddsMax: true } },
        matchOdds: true,
      },
    }),
    MatchRepository.count(),
  ]);

  const matchIds = matches.map((m: any) => m.id);
  const allPredictions = matchIds.length > 0
    ? await prisma.prediction.findMany({
        where: { matchId: { in: matchIds } },
        select: { matchId: true, homeScore: true, awayScore: true },
      })
    : [];

  const poolByMatch = new Map<number, { homeWin: number; draw: number; awayWin: number }>();
  for (const p of allPredictions) {
    const pool = poolByMatch.get(p.matchId) ?? { homeWin: 0, draw: 0, awayWin: 0 };
    pool[deriveOutcome(p.homeScore, p.awayScore)]++;
    poolByMatch.set(p.matchId, pool);
  }

  const serialized = matches.map((m: any) => {
    const pool = poolByMatch.get(m.id) ?? { homeWin: 0, draw: 0, awayWin: 0 };
    const oddsMin = m.season ? Number(m.season.oddsMin) : ODDS_MIN_DEFAULT;
    const oddsMax = m.season ? Number(m.season.oddsMax) : ODDS_MAX_DEFAULT;
    const locked = !!m.matchOdds?.lockedAt;
    const odds = locked
      ? { homeWin: Number(m.matchOdds.homeWinOdds), draw: Number(m.matchOdds.drawOdds), awayWin: Number(m.matchOdds.awayWinOdds) }
      : calcMatchOdds(pool, { oddsEnabled: true, oddsMin, oddsMax });

    return {
      ...serializeMatch(m),
      odds: {
        homeWinVotes: pool.homeWin,
        drawVotes: pool.draw,
        awayWinVotes: pool.awayWin,
        totalVotes: pool.homeWin + pool.draw + pool.awayWin,
        homeWinOdds: odds.homeWin,
        drawOdds: odds.draw,
        awayWinOdds: odds.awayWin,
        locked,
      },
    };
  });

  return NextResponse.json({ matches: serialized, total, page });
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

    // Send notifications for the new custom match (fire-and-forget, don't fail the request)
    (async () => {
      try {
        const matchForEmail: MatchForEmail = {
          homeTeamName: match.homeTeamName,
          awayTeamName: match.awayTeamName,
          kickoffTime: match.kickoffTime,
          leagueName: 'Others',
        };
        const emailUsers = await UserRepository.findMany({
          where: { notificationEmail: { not: null } },
          select: { notificationEmail: true },
        });
        for (const u of emailUsers) {
          if (u.notificationEmail) await sendNewMatchesEmail(u.notificationEmail, [matchForEmail]);
        }
        const pushUserIds = (await DeviceTokenRepository.findMany({
          select: { userId: true },
          distinct: ['userId'],
        })).map(d => d.userId);
        if (pushUserIds.length > 0) {
          await sendPushToUsers(pushUserIds, {
            title: 'New match added',
            body: `${match.homeTeamName} vs ${match.awayTeamName} — place your prediction!`,
            data: { type: 'new_matches' },
          });
        }
      } catch (e) {
        logger.error('[admin/matches] Failed to send custom match notifications:', { error: e instanceof Error ? e.message : String(e) });
      }
    })();

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
  const to   = format(addDays(weekStart, 6), 'yyyy-MM-dd');

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
