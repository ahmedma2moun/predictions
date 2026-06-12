import { auth } from "@/lib/auth";
import { PredictionTabs, type SerializedPrediction } from "./PredictionTabs";
import { PredictionRepository } from '@/lib/repositories/prediction-repository';
import { getAccuracyStats } from '@/lib/services/prediction-service';
import { AccuracyStatsCard } from './AccuracyStatsCard';

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function PredictionsPage() {
  const session = await auth();
  const userId = Number((session!.user as { id: string }).id);

  const [predictions, accuracyStats] = await Promise.all([
    PredictionRepository.findMany({
      where: { userId },
      include: {
        match: {
          select: {
            id: true,
            kickoffTime: true,
            status: true,
            homeTeamName: true,
            awayTeamName: true,
            resultHomeScore: true,
            resultAwayScore: true,
            resultPenaltyHomeScore: true,
            resultPenaltyAwayScore: true,
            matchOdds: {
              select: {
                homeWinOdds: true,
                drawOdds: true,
                awayWinOdds: true,
                homeWinVotes: true,
                drawVotes: true,
                awayWinVotes: true,
                lockedAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    getAccuracyStats(userId),
  ]);

  const allPreds: SerializedPrediction[] = predictions.map((p) => ({
    _id: p.id.toString(),
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    pointsAwarded: p.pointsAwarded,
    baseScore: p.baseScore,
    outcomeOdds: Number(p.outcomeOdds),
    scoringBreakdown: (p.scoringBreakdown as { rules: SerializedPrediction["scoringBreakdown"] } | null)?.rules ?? null,
    oddsBonus: (p.scoringBreakdown as { odds?: SerializedPrediction["oddsBonus"] } | null)?.odds ?? null,
    matchId: {
      _id: p.match.id.toString(),
      kickoffTime: p.match.kickoffTime.toISOString(),
      status: p.match.status,
      homeTeam: { name: p.match.homeTeamName },
      awayTeam: { name: p.match.awayTeamName },
      result:
        p.match.resultHomeScore !== null && p.match.resultHomeScore !== undefined
          ? {
              homeScore: p.match.resultHomeScore,
              awayScore: p.match.resultAwayScore!,
              penaltyHomeScore: p.match.resultPenaltyHomeScore ?? null,
              penaltyAwayScore: p.match.resultPenaltyAwayScore ?? null,
            }
          : undefined,
      odds: p.match.matchOdds
        ? {
            homeWin: Number(p.match.matchOdds.homeWinOdds),
            draw: Number(p.match.matchOdds.drawOdds),
            awayWin: Number(p.match.matchOdds.awayWinOdds),
            locked: !!p.match.matchOdds.lockedAt,
            votes: {
              homeWin: p.match.matchOdds.homeWinVotes,
              draw: p.match.matchOdds.drawVotes,
              awayWin: p.match.matchOdds.awayWinVotes,
            },
          }
        : null,
    },
  }));

  allPreds.sort((a, b) => new Date(b.matchId.kickoffTime).getTime() - new Date(a.matchId.kickoffTime).getTime());

  // Week points
  const weekStart = getWeekStart();
  const weekPoints = allPreds
    .filter(p => {
      if (!p.matchId.result) return false;
      return new Date(p.matchId.kickoffTime).getTime() >= weekStart.getTime();
    })
    .reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);

  // Last 10 finished predictions for sparkline
  const recentPoints = allPreds
    .filter(p => !!p.matchId.result)
    .slice(0, 10)
    .reverse()
    .map(p => p.pointsAwarded || 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">My Score</h1>

      {accuracyStats.totalFinished > 0 && (
        <AccuracyStatsCard
          stats={accuracyStats}
          weekPoints={weekPoints}
          recentPoints={recentPoints}
        />
      )}

      {allPreds.length === 0 ? (
        <p className="text-muted-foreground">No predictions yet. Go predict some matches!</p>
      ) : (
        <PredictionTabs allPreds={allPreds} />
      )}
    </div>
  );
}
