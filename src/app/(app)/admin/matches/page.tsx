"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatKickoff } from "@/lib/utils";

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchingMonth, setFetchingMonth] = useState(false);

  async function loadMatches() {
    const r = await fetch("/api/admin/matches");
    const data = await r.json();
    setMatches(data.matches || []);
    setLoading(false);
  }

  useEffect(() => { loadMatches(); }, []);

  async function fetchMatches() {
    setFetching(true);
    const r = await fetch("/api/admin/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch" }) });
    const data = await r.json();
    toast.success(`Added ${data.inserted} matches (${data.skipped} already existed)`);
    await loadMatches();
    setFetching(false);
  }

  async function fetchNextMonth() {
    setFetchingMonth(true);
    const r = await fetch("/api/admin/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch-month" }) });
    const data = await r.json();
    toast.success(`Added ${data.inserted} matches (${data.skipped} already existed)`);
    await loadMatches();
    setFetchingMonth(false);
  }

  const statusColors: Record<string, any> = { scheduled: "outline", live: "destructive", finished: "secondary", postponed: "secondary", cancelled: "secondary" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Matches</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchNextMonth} disabled={fetchingMonth}>{fetchingMonth ? "Fetching..." : "Fetch Next Month"}</Button>
          <Button onClick={fetchMatches} disabled={fetching}>{fetching ? "Fetching..." : "Fetch This Week"}</Button>
        </div>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-2">
          {loading ? <p className="text-muted-foreground">Loading...</p> : matches.length === 0 ? (
            <p className="text-muted-foreground">No matches yet.</p>
          ) : (
            matches.map(match => (
              <div key={match._id} className="flex items-center justify-between p-3 rounded-lg bg-accent">
                <div>
                  <p className="font-medium text-sm">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                  <p className="text-xs text-muted-foreground">{formatKickoff(match.kickoffTime)}</p>
                  {match.result && <p className="text-xs text-muted-foreground">Result: {match.result.homeScore}–{match.result.awayScore}</p>}
                </div>
                <Badge variant={statusColors[match.status] || "outline"}>{match.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
