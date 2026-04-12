import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { isMatchLocked } from "@/lib/utils";
import { PredictionTabs, type SerializedPrediction } from "./PredictionTabs";

export default async function PredictionsPage() {
  const session = await auth();
  const userId = Number((session!.user as { id: string }).id);

  const predictions = await prisma.prediction.findMany({
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
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const serialized: SerializedPrediction[] = predictions.map((p) => ({
    _id: p.id.toString(),
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    pointsAwarded: p.pointsAwarded,
    scoringBreakdown: (p.scoringBreakdown as { rules: SerializedPrediction["scoringBreakdown"] } | null)?.rules ?? null,
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
    },
  }));

  const totalPoints = serialized.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);

  const futurePreds = serialized
    .filter((p) => !isMatchLocked(p.matchId.kickoffTime))
    .sort(
      (a, b) =>
        new Date(a.matchId.kickoffTime).getTime() - new Date(b.matchId.kickoffTime).getTime()
    );

  const pastPreds = serialized
    .filter((p) => isMatchLocked(p.matchId.kickoffTime))
    .sort(
      (a, b) =>
        new Date(b.matchId.kickoffTime).getTime() - new Date(a.matchId.kickoffTime).getTime()
    );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Predictions</h1>
        <Badge variant="outline" className="text-base px-3 py-1">
          {totalPoints} pts total
        </Badge>
      </div>

      {serialized.length === 0 ? (
        <p className="text-muted-foreground">No predictions yet. Go predict some matches!</p>
      ) : (
        <PredictionTabs futurePreds={futurePreds} pastPreds={pastPreds} />
      )}
    </div>
  );
}
