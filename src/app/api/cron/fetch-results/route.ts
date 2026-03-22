import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Match } from '@/models/Match';
import { Prediction } from '@/models/Prediction';
import { ScoringRule } from '@/models/ScoringRule';
import { fetchFixtures, mapFixtureStatus } from '@/lib/football-api';
import { calculateScore } from '@/lib/scoring-engine';
import { League } from '@/models/League';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = format(yesterday, 'yyyy-MM-dd');

  const activeLeagues = await League.find({ isActive: true });
  const rules = await ScoringRule.find({ isActive: true }).lean();
  let updated = 0, scored = 0, errors = 0;

  for (const league of activeLeagues) {
    try {
      const fixtures = await fetchFixtures({ league: league.externalId, season: league.season, date: dateStr });
      for (const f of fixtures) {
        const status = mapFixtureStatus(f.fixture.status.short);
        if (status !== 'finished') continue;

        const homeScore = f.score.fulltime.home ?? f.goals.home;
        const awayScore = f.score.fulltime.away ?? f.goals.away;
        if (homeScore === null || awayScore === null) continue;

        const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
        const match = await Match.findOneAndUpdate(
          { externalId: f.fixture.id },
          { status: 'finished', result: { homeScore, awayScore, winner } },
          { new: true }
        );
        if (!match) continue;
        updated++;

        if (match.scoresProcessed) continue;
        const predictions = await Prediction.find({ matchId: match._id });
        for (const pred of predictions) {
          const { totalPoints, breakdown } = calculateScore(
            { homeScore: pred.homeScore, awayScore: pred.awayScore },
            { homeScore, awayScore, winner },
            rules as any
          );
          pred.pointsAwarded = totalPoints;
          pred.scoringBreakdown = { rules: breakdown };
          await pred.save();
          scored++;
        }
        match.scoresProcessed = true;
        await match.save();
      }
    } catch (e) {
      console.error(`Error fetching results for league ${league.externalId}:`, e);
      errors++;
    }
  }

  return NextResponse.json({ updated, scored, errors, timestamp: new Date().toISOString() });
}
