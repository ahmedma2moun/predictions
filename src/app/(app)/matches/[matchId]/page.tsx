"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { isMatchLocked, formatStage, formatMatchStatus, isKnockoutStage, ordinal } from "@/lib/utils";
import { KickoffTime } from "@/components/KickoffTime";
import { toast } from "sonner";
import { ChevronLeft, Minus, Plus, Lock, Pencil, Check, X } from "lucide-react";
import { MatchH2H } from "./MatchH2H";
import type { H2HMatch } from "./MatchH2H";
import { MatchStandings } from "./MatchStandings";
import type { Standing } from "./MatchStandings";
import { AllPredictionsList } from "./AllPredictionsList";
import type { PredictionRow } from "./AllPredictionsList";
import { GroupPredictions } from "./GroupPredictions";

function ScoreInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-12 w-12 rounded-full"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="text-3xl font-bold tabular-nums w-12 text-center">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-12 w-12 rounded-full"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function MatchPredictionPage() {
  const { matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [allPredictions, setAllPredictions] = useState<PredictionRow[] | null>(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingResult, setEditingResult] = useState(false);
  const [editHome, setEditHome] = useState("");
  const [editAway, setEditAway] = useState("");
  const [savingResult, setSavingResult] = useState(false);
  const [locked, setLocked] = useState(false);
  const [h2h, setH2h] = useState<H2HMatch[] | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);

  useEffect(() => {
    setH2hLoading(true);
    Promise.all([
      fetch(`/api/matches/${matchId}`).then(r => r.json()),
      fetch(`/api/matches/${matchId}/h2h`).then(r => r.ok ? r.json() : { matches: null }).catch(() => ({ matches: null })),
    ]).then(([matchData, h2hData]) => {
      setMatch(matchData);
      setAllPredictions(matchData.allPredictions ?? null);
      if (matchData.prediction) {
        setHomeScore(matchData.prediction.homeScore);
        setAwayScore(matchData.prediction.awayScore);
      }
      setLocked(isMatchLocked(matchData.kickoffTime));
      setLoading(false);
      setH2h(h2hData.matches ?? null);
      setH2hLoading(false);
    });
  }, [matchId]);

  // Auto-lock at kickoff if the page is left open — avoids a full re-fetch.
  useEffect(() => {
    if (!match || locked) return;
    const ms = new Date(match.kickoffTime).getTime() - Date.now();
    if (ms <= 0) { const t = setTimeout(() => setLocked(true), 0); return () => clearTimeout(t); }
    const timer = setTimeout(() => setLocked(true), ms);
    return () => clearTimeout(timer);
  }, [match, locked]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin text-4xl">⚽</div></div>;
  if (!match) return <div className="p-4">Match not found</div>;

  const isAdmin = match.isAdmin as boolean;
  const isKnockout = isKnockoutStage(match.stage);
  const standings: { home: Standing; away: Standing } = match.standings ?? { home: null, away: null };

  async function handleSaveResult() {
    const h = parseInt(editHome, 10);
    const a = parseInt(editAway, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast.error("Invalid scores");
      return;
    }
    setSavingResult(true);
    try {
      const res = await fetch(`/api/admin/results/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeScore: h, awayScore: a }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update");
      }
      const data = await res.json();
      setMatch((prev: any) => ({
        ...prev,
        result: { homeScore: h, awayScore: a },
        resultHomeScore: h,
        resultAwayScore: a,
      }));
      setAllPredictions(
        data.predictions.map((p: any) => ({
          userId: p.userId,
          userName: p.userName,
          homeScore: p.homeScore,
          awayScore: p.awayScore,
          pointsAwarded: p.pointsAwarded,
          scoringBreakdown: p.scoringBreakdown,
        }))
      );
      toast.success(`Result updated — ${data.emailsSent} correction email${data.emailsSent !== 1 ? "s" : ""} sent`);
      setEditingResult(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update result");
    } finally {
      setSavingResult(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isAdmin) return;
    setSaving(true);
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, homeScore, awayScore }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Prediction saved!");
      router.push("/matches");
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to save");
    }
  }

  const winner = homeScore > awayScore ? match.homeTeam.name : awayScore > homeScore ? match.awayTeam.name : "Draw";

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <Button variant="ghost" onClick={() => router.back()} className="gap-2 pl-0">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{isAdmin ? "Match Details" : "Predict Score"}</CardTitle>
            <Badge variant={match.status === "live" ? "destructive" : locked ? "secondary" : "outline"}>
              {locked ? <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Locked</span> : formatMatchStatus(match.status)}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground"><KickoffTime date={match.kickoffTime} /></p>
            {isKnockoutStage(match.stage) ? (
              <p className="text-xs text-muted-foreground">
                {formatStage(match.stage)}{match.leg ? ` · Leg ${match.leg}` : ''}
              </p>
            ) : match.matchday ? (
              <p className="text-xs text-muted-foreground">Matchday {match.matchday}</p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex flex-col items-center gap-3">
                {match.homeTeam.logo && <Image src={match.homeTeam.logo} alt={match.homeTeam.name} width={64} height={64} className="object-contain" />}
                <p className="font-semibold text-center text-sm">{match.homeTeam.name}</p>
                {!isKnockout && standings.home && (
                  <p className="text-xs text-muted-foreground">{ordinal(standings.home.position)}</p>
                )}
                {!isAdmin && <ScoreInput value={homeScore} onChange={setHomeScore} disabled={locked} />}
              </div>
              <div className="text-muted-foreground font-bold text-xl">–</div>
              <div className="flex-1 flex flex-col items-center gap-3">
                {match.awayTeam.logo && <Image src={match.awayTeam.logo} alt={match.awayTeam.name} width={64} height={64} className="object-contain" />}
                <p className="font-semibold text-center text-sm">{match.awayTeam.name}</p>
                {!isKnockout && standings.away && (
                  <p className="text-xs text-muted-foreground">{ordinal(standings.away.position)}</p>
                )}
                {!isAdmin && <ScoreInput value={awayScore} onChange={setAwayScore} disabled={locked} />}
              </div>
            </div>

            {!isAdmin && !locked && (
              <div className="text-center text-sm text-muted-foreground">
                Predicted outcome: <span className="text-foreground font-medium">{winner}</span>
              </div>
            )}

            {match.result && (
              <div className="bg-accent rounded-lg p-3 text-center relative">
                {isAdmin && !editingResult && (
                  <button
                    onClick={() => { setEditHome(String(match.result.homeScore)); setEditAway(String(match.result.awayScore)); setEditingResult(true); }}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Edit result"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <p className="text-xs text-muted-foreground mb-1">Final Result</p>
                {editingResult ? (
                  <div className="flex items-center justify-center gap-2 my-1">
                    <Input
                      type="number"
                      min={0}
                      value={editHome}
                      onChange={(e) => setEditHome(e.target.value)}
                      className="w-16 h-9 text-center text-lg font-bold tabular-nums px-1"
                    />
                    <span className="text-xl font-bold text-muted-foreground">–</span>
                    <Input
                      type="number"
                      min={0}
                      value={editAway}
                      onChange={(e) => setEditAway(e.target.value)}
                      className="w-16 h-9 text-center text-lg font-bold tabular-nums px-1"
                    />
                    <Button size="icon" variant="default" className="h-8 w-8" onClick={handleSaveResult} disabled={savingResult}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingResult(false)} disabled={savingResult}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-2xl font-bold">{match.result.homeScore} – {match.result.awayScore}</p>
                )}
                {match.result.penaltyHomeScore != null && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Penalties: {match.result.penaltyHomeScore} – {match.result.penaltyAwayScore}
                  </p>
                )}
                {!isAdmin && !isKnockout && match.prediction && (
                  <p className="text-sm mt-1">
                    <span className="text-yellow-500 font-bold">+{match.prediction.pointsAwarded} pts</span>
                  </p>
                )}
              </div>
            )}

            {!isAdmin && (
              !locked ? (
                <form onSubmit={handleSubmit}>
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? "Saving..." : match.prediction ? "Update Prediction" : "Save Prediction"}
                  </Button>
                </form>
              ) : (
                <p className="text-center text-sm text-muted-foreground">Predictions are locked for this match</p>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <MatchH2H
        h2h={h2h}
        loading={h2hLoading}
        homeTeamName={match.homeTeam?.name}
        awayTeamName={match.awayTeam?.name}
      />

      {!isKnockout && (
        <MatchStandings
          homeTeamName={match.homeTeam.name}
          awayTeamName={match.awayTeam.name}
          standings={standings}
        />
      )}

      {(locked || isAdmin) && (
        <GroupPredictions
          matchId={String(matchId)}
          hasResult={!!match.result}
          isKnockout={isKnockout}
        />
      )}

      {(locked || isAdmin) && allPredictions && (
        <AllPredictionsList
          predictions={allPredictions}
          hasResult={!!match.result}
          isKnockout={isKnockout}
        />
      )}
    </div>
  );
}
