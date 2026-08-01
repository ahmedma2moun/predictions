import { NextRequest, NextResponse } from 'next/server';
import { auth, isSessionAdmin } from '@/lib/auth';
import { sendNewMatchesEmail, sendResultsEmail } from '@/lib/email';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { withErrorHandling } from '@/lib/api-handler';
import { requireOneOf } from '@/lib/validation';

export const POST = withErrorHandling('admin/test-email POST', async (req: NextRequest) => {
  const session = await auth();
  if (!session || !isSessionAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { to, type: rawType } = await req.json();
  if (!to) {
    return NextResponse.json({ error: 'Missing to' }, { status: 400 });
  }
  const type = requireOneOf(rawType, ['matches', 'results'] as const, 'type');

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ error: 'GMAIL_USER or GMAIL_APP_PASSWORD env vars are not set' }, { status: 500 });
  }

  if (type === 'matches') {
    // Use real upcoming matches if any, otherwise use dummy data
    const matches = await MatchRepository.findMany({
      where: { status: 'scheduled' },
      include: { league: { select: { name: true } } },
      orderBy: { kickoffTime: 'asc' },
      take: 10,
    });

    const matchesForEmail = matches.length > 0
      ? matches.map(m => ({
          homeTeamName: m.homeTeamName,
          awayTeamName: m.awayTeamName,
          kickoffTime: m.kickoffTime,
          leagueName: m.league?.name ?? 'Unknown League',
        }))
      : [
          { homeTeamName: 'Team A', awayTeamName: 'Team B', kickoffTime: new Date(), leagueName: 'Test League' },
          { homeTeamName: 'Team C', awayTeamName: 'Team D', kickoffTime: new Date(Date.now() + 86400000), leagueName: 'Test League' },
        ];

    await sendNewMatchesEmail(to, matchesForEmail);
  } else {
    await sendResultsEmail(to, [
      {
        homeTeamName: 'Man City',
        awayTeamName: 'Arsenal',
        kickoffTime: new Date(),
        leagueName: 'Premier League',
        resultHomeScore: 2,
        resultAwayScore: 1,
        predictionHomeScore: 2,
        predictionAwayScore: 0,
        pointsAwarded: 4,
        scoringBreakdown: [
          { ruleName: 'correct_winner', pointsAwarded: 2, matched: true },
          { ruleName: 'exact_score', pointsAwarded: 5, matched: false },
          { ruleName: 'score_difference', pointsAwarded: 3, matched: false },
          { ruleName: 'one_team_score', pointsAwarded: 1, matched: false },
        ],
      },
      {
        homeTeamName: 'Real Madrid',
        awayTeamName: 'Barcelona',
        kickoffTime: new Date(Date.now() + 3600000),
        leagueName: 'La Liga',
        resultHomeScore: 1,
        resultAwayScore: 1,
        predictionHomeScore: null,
        predictionAwayScore: null,
        pointsAwarded: 0,
        scoringBreakdown: null,
      },
    ]);
  }

  return NextResponse.json({ ok: true, sentTo: to, type });
});
