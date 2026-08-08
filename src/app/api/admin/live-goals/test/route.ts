import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { triggerLiveGoalTestTick } from '@/lib/live-goal-service';
import { safeParseBody } from '@/lib/request';
import { withErrorHandling } from '@/lib/api-handler';

interface TestTickBody {
  matchId: unknown;
}

export const POST = withErrorHandling('admin/live-goals/test POST', async (req: NextRequest) => {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await safeParseBody<TestTickBody>(req);
  const matchId = Number(body?.matchId);
  if (!matchId) return NextResponse.json({ error: 'matchId is required' }, { status: 400 });

  const match = await MatchRepository.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (!match.externalId) {
    return NextResponse.json({ error: 'This match has no externalId — nothing for the live-goal poller to fetch' }, { status: 400 });
  }

  await triggerLiveGoalTestTick(match.externalId);

  return NextResponse.json({
    ok: true,
    message: `Tick published for "${match.homeTeamName} vs ${match.awayTeamName}" — check server logs (or your device, if this match has live predictors) within a few seconds.`,
  });
});
