"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKickoff } from "@/lib/utils";

type RuleBreakdown = { ruleName: string; pointsAwarded: number; matched: boolean };

export type SerializedPrediction = {
  _id: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number;
  scoringBreakdown: RuleBreakdown[] | null;
  matchId: {
    _id: string;
    kickoffTime: string;
    status: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    result?: { homeScore: number; awayScore: number };
  };
};

function PredictionCard({ pred }: { pred: SerializedPrediction }) {
  const match = pred.matchId;
  const isFinished = match.status === "finished";
  return (
    <Card className={isFinished && pred.pointsAwarded > 0 ? "border-green-500/30" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{formatKickoff(match.kickoffTime)}</span>
          <div className="flex items-center gap-2">
            <Badge variant={isFinished ? "secondary" : "outline"} className="text-xs">
              {match.status.toUpperCase()}
            </Badge>
            {isFinished && (
              <Badge
                variant={pred.pointsAwarded > 0 ? "default" : "secondary"}
                className="text-xs"
              >
                +{pred.pointsAwarded} pts
              </Badge>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Home</p>
            <p className="font-medium text-sm">{match.homeTeam?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Your pick</p>
            <p className="font-bold text-lg">
              {pred.homeScore} – {pred.awayScore}
            </p>
            {isFinished && match.result && (
              <p className="text-xs text-muted-foreground">
                Actual: {match.result.homeScore} – {match.result.awayScore}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Away</p>
            <p className="font-medium text-sm">{match.awayTeam?.name}</p>
          </div>
        </div>
        {isFinished && pred.scoringBreakdown && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-x-3 gap-y-1">
            {pred.scoringBreakdown.map((rule) => (
              <span
                key={rule.ruleName}
                className={`text-xs ${
                  rule.matched
                    ? "text-green-500 font-medium"
                    : "text-muted-foreground line-through"
                }`}
              >
                {rule.ruleName} +{rule.pointsAwarded}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PredictionTabs({
  futurePreds,
  pastPreds,
}: {
  futurePreds: SerializedPrediction[];
  pastPreds: SerializedPrediction[];
}) {
  return (
    <Tabs defaultValue="past">
      <TabsList className="w-full">
        <TabsTrigger value="future" className="flex-1">
          Upcoming
          {futurePreds.length > 0 && (
            <span className="ml-1.5 text-xs opacity-70">({futurePreds.length})</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="past" className="flex-1">
          Past
          {pastPreds.length > 0 && (
            <span className="ml-1.5 text-xs opacity-70">({pastPreds.length})</span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="future" className="space-y-3 mt-4">
        {futurePreds.length === 0 ? (
          <p className="text-muted-foreground text-sm">No upcoming predictions.</p>
        ) : (
          futurePreds.map((pred) => <PredictionCard key={pred._id} pred={pred} />)
        )}
      </TabsContent>

      <TabsContent value="past" className="space-y-3 mt-4">
        {pastPreds.length === 0 ? (
          <p className="text-muted-foreground text-sm">No past predictions yet.</p>
        ) : (
          pastPreds.map((pred) => <PredictionCard key={pred._id} pred={pred} />)
        )}
      </TabsContent>
    </Tabs>
  );
}
