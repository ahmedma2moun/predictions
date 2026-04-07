"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKickoff } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

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

type OtherPrediction = {
  userId: number;
  userName: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number | null;
};

function PredictionCard({ pred }: { pred: SerializedPrediction }) {
  const match = pred.matchId;
  const isFinished = match.status === "finished";
  const isLocked = match.status !== "upcoming" && match.status !== "scheduled";

  const [open, setOpen] = useState(false);
  const [others, setOthers] = useState<OtherPrediction[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!open && others === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/matches/${match._id}`);
        const data = await res.json();
        setOthers(data.allPredictions ?? []);
      } finally {
        setLoading(false);
      }
    }
    setOpen((v) => !v);
  }

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
                Result: {match.result.homeScore} – {match.result.awayScore}
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
        {isLocked && (
          <button
            onClick={toggle}
            className="mt-3 pt-3 border-t w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {loading ? (
              "Loading..."
            ) : (
              <>
                {open ? "Hide" : "Show"} all predictions
                {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </>
            )}
          </button>
        )}
        {open && others && others.length > 0 && (
          <div className="mt-2 space-y-1">
            {others.map((o) => (
              <div
                key={o.userId}
                className="flex items-center justify-between text-xs px-2 py-1 rounded-md bg-muted/40"
              >
                <span className="font-medium truncate max-w-[120px]">{o.userName}</span>
                <span className="font-mono tabular-nums">
                  {o.homeScore} – {o.awayScore}
                </span>
                {isFinished && (
                  <span
                    className={`ml-2 ${
                      (o.pointsAwarded ?? 0) > 0 ? "text-green-500" : "text-muted-foreground"
                    }`}
                  >
                    +{o.pointsAwarded ?? 0} pts
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {open && others && others.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground text-center">No other predictions.</p>
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
