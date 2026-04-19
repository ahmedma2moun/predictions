"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoringBreakdown } from "@/components/ScoringBreakdown";
import type { RuleBreakdown } from "@/components/ScoringBreakdown";

interface GroupPredictionEntry {
  userId: string;
  userName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  pointsAwarded: number | null;
  scoringBreakdown: RuleBreakdown[] | null;
  predicted: boolean;
}

interface Group {
  id: string;
  name: string;
  isDefault: boolean;
}

export function GroupPredictions({
  matchId,
  hasResult,
  isKnockout,
}: {
  matchId: string;
  hasResult: boolean;
  isKnockout: boolean;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<GroupPredictionEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/groups')
      .then(r => r.json())
      .then((data: Group[]) => {
        setGroups(data);
        if (data.length > 0) setSelectedGroupId(data[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    setLoading(true);
    setPredictions(null);
    fetch(`/api/matches/${matchId}/group-predictions?groupId=${selectedGroupId}`)
      .then(r => r.json())
      .then(data => setPredictions(Array.isArray(data) ? data : null))
      .catch(() => setPredictions(null))
      .finally(() => setLoading(false));
  }, [matchId, selectedGroupId]);

  if (groups.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Group Comparison</CardTitle>
          {groups.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    selectedGroupId === g.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground",
                  )}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
        ) : !predictions || predictions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No predictions in this group.</p>
        ) : (
          <div className="divide-y">
            {predictions.map(p => (
              <div key={p.userId} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{p.userName ?? 'Unknown'}</span>
                  {p.predicted ? (
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm">{p.homeScore} – {p.awayScore}</span>
                      {!isKnockout && hasResult && p.scoringBreakdown && p.scoringBreakdown.length > 0 && (
                        <ScoringBreakdown rules={p.scoringBreakdown} />
                      )}
                      {!isKnockout && hasResult && (
                        (p.pointsAwarded ?? 0) > 0
                          ? <span className="text-yellow-500 font-bold text-sm">+{p.pointsAwarded} pts</span>
                          : <span className="text-muted-foreground text-sm">0 pts</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No prediction</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
