"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isMatchLocked, formatStage, isKnockoutStage, ordinal } from "@/lib/utils";
import { KickoffTime } from "@/components/KickoffTime";
import { toast } from "sonner";
import { ChevronLeft, Minus, Plus, Lock, Pencil, Check, X, Calculator } from "lucide-react";
import { MatchH2H } from "./MatchH2H";
import type { H2HMatch } from "./MatchH2H";
import { MatchStandings } from "./MatchStandings";
import type { Standing } from "./MatchStandings";
import { AllPredictionsList } from "./AllPredictionsList";
import type { PredictionRow } from "./AllPredictionsList";
import { GroupPredictions } from "./GroupPredictions";

function ScoreInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex items-center bg-card-elevated border border-border rounded-md p-1 gap-1">
      <button
        type="button"
        className="h-9 w-9 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="text-3xl font-bold font-mono-nums w-10 text-center leading-none">{value}</span>
      <button
        type="button"
        className="h-9 w-9 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
      </button>
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
  const [addingResult, setAddingResult] = useState(false);
  const [editHome, setEditHome] = useState("");
  const [editAway, setEditAway] = useState("");
  const [savingResult, setSavingResult] = useState(false);
  const [calculatingScores, setCalculatingScores] = useState(false);
  const [locked, setLocked] = useState(false);
  const [h2h, setH2h] = useState<H2HMatch[] | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [liveScore, setLiveScore] = useState<{ homeScore: number | null; awayScore: number | null } | null>(null);

  const isCustom = match?.externalId === null || match?.externalId === undefined && match?.externalLeagueId === 0;

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

  useEffect(() => {
    if (!match || locked) return;
    const ms = new Date(match.kickoffTime).getTime() - Date.now();
    if (ms <= 0) { const t = setTimeout(() => setLocked(true), 0); return () => clearTimeout(t); }
    const timer = setTimeout(() => setLocked(true), ms);
    return () => clearTimeout(timer);
  }, [match, locked]);

  useEffect(() => {
    if (!match || !locked || !match.externalId) return;

    async function fetchLive() {
      const res = await fetch(`/api/matches/${matchId}/live`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      if (data.homeScore !== null && data.awayScore !== null) {
        setLiveScore({ homeScore: data.homeScore, awayScore: data.awayScore });
      }
    }

    fetchLive();
  }, [match, matchId, locked]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin text-4xl">⚽</div></div>;
  if (!match) return <div className="p-4">Match not found</div>;

  const isAdmin = match.isAdmin as boolean;
  const isKnockout = isKnockoutStage(match.stage);
  const standings: { home: Standing; away: Standing } = match.standings ?? { home: null, away: null };

  const winner = homeScore > awayScore
    ? match.homeTeam.name
    : awayScore > homeScore
    ? match.awayTeam.name
    : "Draw";

  // Competition header label: "MD 35 · PREMIER LEAGUE" or stage
  const compLabel = match.matchday
    ? `MD ${match.matchday}${match.leagueName ? ` · ${match.leagueName.toUpperCase()}` : ''}`
    : isKnockoutStage(match.stage)
    ? `${formatStage(match.stage)}${match.leg ? ` · LEG ${match.leg}` : ''}`
    : 'MATCH';

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
      toast.success(`Result saved — ${data.emailsSent} correction email${data.emailsSent !== 1 ? "s" : ""} sent`);
      setEditingResult(false);
      setAddingResult(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update result");
    } finally {
      setSavingResult(false);
    }
  }

  async function handleCalculateScores() {
    setCalculatingScores(true);
    try {
      const res = await fetch(`/api/admin/results/${matchId}/calculate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to calculate");
      }
      const data = await res.json();
      toast.success(`Scores calculated — ${data.scored} prediction${data.scored !== 1 ? "s" : ""} scored`);
      const refreshed = await fetch(`/api/matches/${matchId}`).then(r => r.json());
      setAllPredictions(refreshed.allPredictions ?? null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to calculate scores");
    } finally {
      setCalculatingScores(false);
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

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      {/* Custom page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 flex items-center justify-center rounded-full bg-card-elevated border border-border shrink-0 hover:border-border/80 transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground truncate flex-1 text-center">
          {compLabel}
        </span>
        <div className="h-9 w-9 shrink-0" />
      </div>

      {/* Hero predict card */}
      <div className="relative rounded-[20px] border border-border bg-card overflow-hidden p-0">
        {/* Radial tint */}
        <div className="pointer-events-none absolute inset-x-[10%] top-0 h-20 rounded-full bg-primary/[0.08] blur-xl" />

        <div className="relative p-4 space-y-5">
          {/* Date + status row */}
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] text-muted-foreground uppercase font-semibold tracking-wide">
              <KickoffTime date={match.kickoffTime} />
            </span>
            {match.status === "live" ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(255,77,109,0.12)] border border-[rgba(255,77,109,0.30)] text-live text-[10px] font-bold uppercase">
                <span className="animate-live inline-block h-1.5 w-1.5 rounded-full bg-live" />
                LIVE
              </span>
            ) : locked ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-muted-foreground text-[10px] font-bold uppercase">
                <Lock className="h-2.5 w-2.5" />
                LOCKED
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full border border-primary-soft-border bg-primary-soft text-primary text-[10px] font-bold uppercase">
                OPEN
              </span>
            )}
          </div>

          {/* Teams + steppers */}
          <div className="flex items-center justify-between gap-3">
            {/* Home */}
            <div className="flex-1 flex flex-col items-center gap-2">
              {match.homeTeam.logo && (
                <Image src={match.homeTeam.logo} alt={match.homeTeam.name} width={48} height={48} className="object-contain" />
              )}
              <p className="font-semibold text-center text-sm leading-tight">{match.homeTeam.name}</p>
              {!isCustom && !isKnockout && standings.home && (
                <p className="text-[10.5px] text-muted-foreground font-mono-nums">{ordinal(standings.home.position)}</p>
              )}
              {!isAdmin && <ScoreInput value={homeScore} onChange={setHomeScore} disabled={locked} />}
            </div>

            <span className="text-muted-foreground font-bold text-xl shrink-0">–</span>

            {/* Away */}
            <div className="flex-1 flex flex-col items-center gap-2">
              {match.awayTeam.logo && (
                <Image src={match.awayTeam.logo} alt={match.awayTeam.name} width={48} height={48} className="object-contain" />
              )}
              <p className="font-semibold text-center text-sm leading-tight">{match.awayTeam.name}</p>
              {!isCustom && !isKnockout && standings.away && (
                <p className="text-[10.5px] text-muted-foreground font-mono-nums">{ordinal(standings.away.position)}</p>
              )}
              {!isAdmin && <ScoreInput value={awayScore} onChange={setAwayScore} disabled={locked} />}
            </div>
          </div>

          {/* "Your call" summary */}
          {!isAdmin && !locked && (
            <p className="text-center text-sm text-muted-foreground">
              Your call: <span className="text-foreground font-semibold">{winner}</span>
            </p>
          )}

          {/* Live score */}
          {liveScore && (
            <div className="bg-[rgba(255,77,109,0.08)] border border-[rgba(255,77,109,0.25)] rounded-lg p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-live mb-1 flex items-center justify-center gap-1.5">
                <span className="animate-live inline-block h-1.5 w-1.5 rounded-full bg-live" />
                Live Score
              </p>
              <p className="text-2xl font-bold font-mono-nums">
                {liveScore.homeScore} – {liveScore.awayScore}
              </p>
            </div>
          )}

          {/* Existing result display / edit */}
          {match.result && (
            <div className="bg-card-elevated rounded-lg p-3 text-center relative">
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
                  <Input type="number" min={0} value={editHome} onChange={(e) => setEditHome(e.target.value)} className="w-16 h-9 text-center text-lg font-bold font-mono-nums px-1" />
                  <span className="text-xl font-bold text-muted-foreground">–</span>
                  <Input type="number" min={0} value={editAway} onChange={(e) => setEditAway(e.target.value)} className="w-16 h-9 text-center text-lg font-bold font-mono-nums px-1" />
                  <Button size="icon" variant="default" className="h-8 w-8" onClick={handleSaveResult} disabled={savingResult}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingResult(false)} disabled={savingResult}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ) : (
                <p className="text-2xl font-bold font-mono-nums">{match.result.homeScore} – {match.result.awayScore}</p>
              )}
              {match.result.penaltyHomeScore != null && (
                <p className="text-sm text-muted-foreground mt-0.5 font-mono-nums">
                  Penalties: {match.result.penaltyHomeScore} – {match.result.penaltyAwayScore}
                </p>
              )}
              {!isAdmin && !isKnockout && match.prediction && (
                <p className="text-sm mt-1">
                  <span className="text-warning font-bold font-mono-nums">+{match.prediction.pointsAwarded} pts</span>
                </p>
              )}
            </div>
          )}

          {/* Admin: add result */}
          {isAdmin && !match.result && (
            <div className="border border-dashed border-border rounded-lg p-3">
              {!addingResult ? (
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setEditHome("0"); setEditAway("0"); setAddingResult(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Result
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">Enter Result</p>
                  <div className="flex items-center justify-center gap-2">
                    <Input type="number" min={0} value={editHome} onChange={(e) => setEditHome(e.target.value)} className="w-16 h-9 text-center text-lg font-bold font-mono-nums px-1" placeholder="0" />
                    <span className="text-xl font-bold text-muted-foreground">–</span>
                    <Input type="number" min={0} value={editAway} onChange={(e) => setEditAway(e.target.value)} className="w-16 h-9 text-center text-lg font-bold font-mono-nums px-1" placeholder="0" />
                    <Button size="icon" variant="default" className="h-8 w-8" onClick={handleSaveResult} disabled={savingResult}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setAddingResult(false)} disabled={savingResult}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin: calculate scores */}
          {isAdmin && match.result && !editingResult && (
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleCalculateScores} disabled={calculatingScores}>
              <Calculator className="h-3.5 w-3.5" />
              {calculatingScores ? "Calculating..." : "Calculate Scores"}
            </Button>
          )}

          {/* Admin: live odds */}
          {isAdmin && match.odds && (
            <div className="bg-card-elevated rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                  Prediction Odds
                </p>
                <div className="flex items-center gap-1.5">
                  {match.odds.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-[10.5px] text-muted-foreground">
                    {match.odds.totalVotes} vote{match.odds.totalVotes !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {([
                  { label: match.homeTeam.name, odds: match.odds.homeWin, votes: match.odds.homeWinVotes },
                  { label: "Draw",               odds: match.odds.draw,    votes: match.odds.drawVotes },
                  { label: match.awayTeam.name, odds: match.odds.awayWin, votes: match.odds.awayWinVotes },
                ] as const).map(({ label, odds, votes }) => {
                  const pct = match.odds!.totalVotes > 0 ? Math.round((votes / match.odds!.totalVotes) * 100) : null;
                  return (
                    <div key={label} className="bg-background rounded-md p-2 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
                      <p className="text-base font-bold font-mono-nums">{odds.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {pct !== null ? `${pct}%` : "—"} · {votes}v
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save prediction */}
          {!isAdmin && (
            !locked ? (
              <form onSubmit={handleSubmit}>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-12 w-full rounded-md bg-primary text-primary-foreground font-semibold text-sm shadow-[0_0_20px_rgba(16,224,137,0.25)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? "Saving…" : match.prediction ? "Update Prediction" : "Save Prediction"}
                </button>
              </form>
            ) : (
              <p className="text-center text-sm text-muted-foreground">Predictions are locked for this match</p>
            )
          )}
        </div>
      </div>

      {!isCustom && (
        <MatchH2H
          h2h={h2h}
          loading={h2hLoading}
          homeTeamName={match.homeTeam?.name}
          awayTeamName={match.awayTeam?.name}
        />
      )}

      {!isCustom && !isKnockout && (
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
