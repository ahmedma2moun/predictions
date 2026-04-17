"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { toastApiError } from "@/lib/client-api";
import { KickoffTime } from "@/components/KickoffTime";

type AdminMatch = {
  _id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  kickoffTime: string;
  status: string;
  result?: { homeScore: number; awayScore: number };
};

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchingResults, setFetchingResults] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  async function loadMatches() {
    try {
      const r = await fetch("/api/admin/matches");
      if (!r.ok) throw new Error("Failed to load matches");
      const data = await r.json();
      setMatches(data.matches || []);
    } catch {
      setError("Failed to load matches. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMatches(); }, []);

  async function fetchMatches() {
    setFetching(true);
    const r = await fetch("/api/admin/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch" }) });
    if (r.ok) {
      const data = await r.json();
      toast.success(`Added ${data.inserted} matches (${data.skipped} already existed)`);
      await loadMatches();
    } else {
      await toastApiError(r, "Failed to fetch matches");
    }
    setFetching(false);
  }

  async function fetchResults() {
    setFetchingResults(true);
    const r = await fetch("/api/admin/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch-results" }) });
    if (r.ok) {
      const data = await r.json();
      toast.success(`Updated ${data.updated} results, scored ${data.scored} predictions`);
      await loadMatches();
    } else {
      await toastApiError(r, "Failed to fetch results");
    }
    setFetchingResults(false);
  }

  const visibleMatches = [...matches].sort(
    (a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime()
  );

  const allSelected = visibleMatches.length > 0 && visibleMatches.every(m => selected.has(m._id));
  const someSelected = selected.size > 0;

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleMatches.map(m => m._id)));
    }
  }

  async function deleteSelected() {
    if (!selected.size) return;
    setDeleting(true);
    const r = await fetch("/api/admin/matches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    if (r.ok) {
      const data = await r.json();
      toast.success(`Deleted ${data.deleted} match${data.deleted !== 1 ? "es" : ""}`);
      setSelected(new Set());
      await loadMatches();
    } else {
      await toastApiError(r, "Failed to delete matches");
    }
    setDeleting(false);
  }

  const statusColors: Record<string, "outline" | "destructive" | "secondary"> = {
    scheduled: "outline",
    live: "destructive",
    finished: "secondary",
    postponed: "secondary",
    cancelled: "secondary",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Matches</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={fetchResults} disabled={fetchingResults}>
            {fetchingResults ? "Fetching..." : "Fetch Results"}
          </Button>
          <Button onClick={fetchMatches} disabled={fetching}>
            {fetching ? "Fetching..." : "Fetch This Week"}
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
                <Skeleton className="h-6 w-20 rounded" />
              </div>
            ))
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : visibleMatches.length === 0 ? (
            <p className="text-muted-foreground">No matches to display.</p>
          ) : (
            <>
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input"
                  />
                  {someSelected ? `${selected.size} selected` : `${visibleMatches.length} matches`}
                </label>
                {someSelected && (
                  <Button size="sm" variant="destructive" disabled={deleting} onClick={deleteSelected}>
                    {deleting ? "Deleting..." : `Delete ${selected.size}`}
                  </Button>
                )}
              </div>
              {visibleMatches.map(match => (
                <div
                  key={match._id}
                  className={`flex items-center justify-between p-3 rounded-lg bg-accent gap-3 ${selected.has(match._id) ? "ring-2 ring-primary" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(match._id)}
                    onChange={() => toggleSelect(match._id)}
                    className="h-4 w-4 rounded border-input shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                    <p className="text-xs text-muted-foreground"><KickoffTime date={match.kickoffTime} /></p>
                    {match.result && (
                      <p className="text-xs text-muted-foreground">Result: {match.result.homeScore}–{match.result.awayScore}</p>
                    )}
                  </div>
                  <Badge variant={statusColors[match.status] ?? "outline"}>{match.status}</Badge>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
