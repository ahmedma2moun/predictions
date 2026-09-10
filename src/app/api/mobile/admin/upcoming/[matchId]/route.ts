import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/admin-auth';
import { getSessionUser } from '@/lib/auth';
import { getMatchById } from '@/lib/services/match-service';
import { serializeMatchForMobile } from '@/models/Match';
import { serializeBreakdown } from '@/models/Prediction';
import { isKnockoutStage } from '@/lib/utils';
import { getTeamForm } from '@/lib/team-form';
import { fetchFixtureById, mapFixtureStatus } from '@/lib/football/service';
import { getUserGroups } from '@/lib/services/group-service';
import { getGroupPredictionsForMatch } from '@/lib/services/prediction-service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).matchId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });
  const data = await getMatchById(id, { userId: getSessionUser(session).id, isAdmin: true });
  if (!data) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  const { match, homeStanding, awayStanding, allPredictions, odds } = data;
  const section = req.nextUrl.searchParams.get('section');
  if (section === 'predictions') {
    const groupId = Number(req.nextUrl.searchParams.get('groupId'));
    if (!Number.isSafeInteger(groupId) || groupId <= 0) return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    const result = await getGroupPredictionsForMatch(id, groupId, getSessionUser(session).id, true, null);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.entries.map(e => ({ ...e, scoringBreakdown: serializeBreakdown(e.scoringBreakdown) })));
  }
  if (section === 'form') {
    if (!match.externalId) return NextResponse.json({ home: null, away: null });
    try {
      const [home, away] = await Promise.all([getTeamForm(match.homeTeamExtId, 5), getTeamForm(match.awayTeamExtId, 5)]);
      return NextResponse.json({ home, away });
    } catch { return NextResponse.json({ error: 'Recent form is temporarily unavailable.' }, { status: 502 }); }
  }
  if (section === 'live') {
    if (!match.externalId) return NextResponse.json({ status: match.status, events: [] });
    const fixture = await fetchFixtureById(match.externalId).catch(() => null);
    if (!fixture) return NextResponse.json({ error: 'Live updates are temporarily unavailable.' }, { status: 502 });
    return NextResponse.json({
      status: mapFixtureStatus(fixture.fixture.status.short),
      homeScore: fixture.score.fulltime.home ?? fixture.goals.home,
      awayScore: fixture.score.fulltime.away ?? fixture.goals.away,
      events: fixture.events,
    });
  }
  return NextResponse.json({
    ...serializeMatchForMobile({ ...match, leagueName: match.league?.name ?? (match as typeof match & { season?: { name: string } | null }).season?.name }),
    homeStanding, awayStanding, odds, isKnockout: isKnockoutStage(match.stage),
    groups: await getUserGroups(getSessionUser(session).id, true),
    predictions: allPredictions?.map(p => ({ ...p, scoringBreakdown: serializeBreakdown(p.rawBreakdown), rawBreakdown: undefined })) ?? [],
  });
}
