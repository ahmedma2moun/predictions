"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatKickoff } from "@/lib/utils";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchingMonth, setFetchingMonth] = useState(false);
  const [fetchingResults, setFetchingResults] = useState(false);
  const [fetchingPast7, setFetchingPast7] = useState(false);

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

  async function fetchPast7() {
    setFetchingPast7(true);
    const r = await fetch("/api/admin/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch-past7" }) });
    const data = await r.json();
    toast.success(`Added ${data.inserted} new matches from the past 7 days`);
    await loadMatches();
    setFetchingPast7(false);
  }

  async function fetchResults() {
    setFetchingResults(true);
    const r = await fetch("/api/admin/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch-results" }) });
    const data = await r.json();
    toast.success(`Updated ${data.updated} results, scored ${data.scored} predictions`);
    await loadMatches();
    setFetchingResults(false);
  }

  const twoDaysAgo = Date.now() - TWO_DAYS_MS;
  const visibleMatches = matches.filter(m => {
    if (m.status === 'finished' && m.result && new Date(m.kickoffTime).getTime() < twoDaysAgo) return false;
    return true;
  });

  const statusColors: Record<string, any> = { scheduled: "outline", live: "destructive", finished: "secondary", postponed: "secondary", cancelled: "secondary" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Matches</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={fetchResults} disabled={fetchingResults}>
            {fetchingResults ? "Fetching..." : "Fetch Results"}
          </Button>
          <Button variant="outline" onClick={fetchPast7} disabled={fetchingPast7}>
            {fetchingPast7 ? "Fetching..." : "Fetch Past 7 Days"}
          </Button>
          <Button variant="outline" onClick={fetchNextMonth} disabled={fetchingMonth}>
            {fetchingMonth ? "Fetching..." : "Fetch Next Month"}
          </Button>
          <Button onClick={fetchMatches} disabled={fetching}>
            {fetching ? "Fetching..." : "Fetch This Week"}
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-2">
          {loading ? <p className="text-muted-foreground">Loading...</p> : visibleMatches.length === 0 ? (
            <p className="text-muted-foreground">No matches to display.</p>
          ) : (
            visibleMatches.map(match => (
              <div key={match._id} className="flex items-center justify-between p-3 rounded-lg bg-accent">
                <div>
                  <p className="font-medium text-sm">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                  <p className="text-xs text-muted-foreground">{formatKickoff(match.kickoffTime)}</p>
                  {match.result && (
                    <p className="text-xs text-muted-foreground">Result: {match.result.homeScore}–{match.result.awayScore}</p>
                  )}
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
