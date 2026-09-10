"use client";

import { useEffect, useState } from "react";
import { Bell, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Team = { teamLeagueId: number; teamId: number; name: string; logo: string | null };
type League = { id: number; name: string; teams: Team[] };

export default function RemindersPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/reminders").then(async r => {
      if (!r.ok) throw new Error("Failed to load reminder settings");
      return r.json();
    }).then(data => {
      setLeagues(data.leagues);
      setSelected(new Set((data.selections ?? []).flatMap((l: League) => l.teams.map(t => t.teamLeagueId))));
    }).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  function toggle(id: number, checked: boolean) {
    setSelected(previous => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    const invalid = leagues.find(l => { const count = l.teams.filter(t => selected.has(t.teamLeagueId)).length; return count === 1; });
    if (invalid) { toast.error(`Select at least two teams in ${invalid.name}`); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/reminders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selections: [...selected] }) });
      if (response.ok) toast.success("Reminder preferences saved");
      else toast.error((await response.json()).error ?? "Failed to save preferences");
    } catch {
      toast.error("Could not save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-5 max-w-3xl mx-auto">
    <div><h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" /> Match reminders</h1><p className="text-muted-foreground mt-1">Prediction games automatically send a 60-minute reminder. Choose teams below for additional reminders 60 minutes before and at kickoff when both teams are selected in the same league.</p></div>
    {loading ? <p className="text-muted-foreground">Loading teams...</p> : leagues.length === 0 ? <Card><CardContent className="pt-6 text-muted-foreground">No leagues have been enabled for reminders yet.</CardContent></Card> : leagues.map(league => <Card key={league.id}><CardHeader><CardTitle className="text-lg">{league.name}</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-2 gap-3">{league.teams.map(team => <label key={team.teamLeagueId} className="flex items-center justify-between rounded-lg border p-3"><span>{team.name}</span><Switch checked={selected.has(team.teamLeagueId)} onCheckedChange={v => toggle(team.teamLeagueId, v)} /></label>)}</CardContent></Card>)}
    <Button onClick={save} disabled={saving || loading}><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save preferences"}</Button>
  </div>;
}
