"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Calculator } from "lucide-react";
import { toast } from "sonner";

export type MatchResult = {
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away' | 'draw';
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
};

/** Inline home/away score form used both to edit an existing result and to add a new one — same endpoint, same shape. */
export function AdminResultEditForm({
  matchId,
  initialHome,
  initialAway,
  onSaved,
  onCancel,
}: {
  matchId: string;
  initialHome: number;
  initialAway: number;
  onSaved: (result: MatchResult) => void;
  onCancel: () => void;
}) {
  const [home, setHome] = useState(String(initialHome));
  const [away, setAway] = useState(String(initialAway));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast.error("Invalid scores");
      return;
    }
    setSaving(true);
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
      onSaved({
        homeScore: h,
        awayScore: a,
        winner: h === a ? 'draw' : h > a ? 'home' : 'away',
        penaltyHomeScore: null,
        penaltyAwayScore: null,
      });
      toast.success(`Result saved — ${data.emailsSent} correction email${data.emailsSent !== 1 ? "s" : ""} sent`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update result");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 my-1">
      <Input type="number" min={0} value={home} onChange={(e) => setHome(e.target.value)} className="w-16 h-9 text-center text-lg font-bold font-mono-nums px-1" placeholder="0" />
      <span className="text-xl font-bold text-muted-foreground">–</span>
      <Input type="number" min={0} value={away} onChange={(e) => setAway(e.target.value)} className="w-16 h-9 text-center text-lg font-bold font-mono-nums px-1" placeholder="0" />
      <Button size="icon" variant="default" className="h-8 w-8" onClick={handleSave} disabled={saving}><Check className="h-3.5 w-3.5" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel} disabled={saving}><X className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

export function CalculateScoresButton({ matchId }: { matchId: string }) {
  const [calculating, setCalculating] = useState(false);

  async function handleCalculate() {
    setCalculating(true);
    try {
      const res = await fetch(`/api/admin/results/${matchId}/calculate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to calculate");
      }
      const data = await res.json();
      toast.success(`Scores calculated — ${data.scored} prediction${data.scored !== 1 ? "s" : ""} scored`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to calculate scores");
    } finally {
      setCalculating(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleCalculate} disabled={calculating}>
      <Calculator className="h-3.5 w-3.5" />
      {calculating ? "Calculating..." : "Calculate Scores"}
    </Button>
  );
}
