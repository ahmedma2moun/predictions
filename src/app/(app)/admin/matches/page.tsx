"use client";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { toastApiError } from "@/lib/client-api";
import { ODDS_FEATURE_ENABLED } from "@/lib/feature-flags";
import { KickoffTime } from "@/components/KickoffTime";
import { useApiResource } from "@/hooks/useApiResource";
import { Plus, ChevronDown, ChevronUp, Lock, ListFilter } from "lucide-react";

type LeagueOption = {
  _id: string;
  name: string;
  country: string;
  season: number;
  isActive: boolean;
};

type SelectableTeam = {
  _id: string | null;
  externalId: number;
  name: string;
  isActive: boolean;
};

type MatchOddsData = {
  homeWinVotes: number;
  drawVotes: number;
  awayWinVotes: number;
  totalVotes: number;
  homeWinOdds: number;
  drawOdds: number;
  awayWinOdds: number;
  locked: boolean;
};

type AdminMatch = {
  _id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  kickoffTime: string;
  status: string;
  externalId: number | null;
  result?: { homeScore: number; awayScore: number };
  odds?: MatchOddsData;
};

function OddsCell({ label, votes, odds, total }: { label: string; votes: number; odds: number; total: number }) {
  const pct = total > 0 ? `${Math.round((votes / total) * 100)}%` : "—";
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span className="font-semibold text-foreground/70">{label}</span>
      <span>{odds.toFixed(2)}</span>
      <span className="text-muted-foreground/60">({pct})</span>
    </span>
  );
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchingNextMonth, setFetchingNextMonth] = useState(false);
  const [fetchingResults, setFetchingResults] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Custom match form state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customHome, setCustomHome] = useState("");
  const [customAway, setCustomAway] = useState("");
  const [customKickoff, setCustomKickoff] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);

  // Selective fetch form state (league + teams + days + notify)
  const [showSelectiveForm, setShowSelectiveForm] = useState(false);
  const [selectiveLeagueId, setSelectiveLeagueId] = useState("");
  const [selectiveTeams, setSelectiveTeams] = useState<SelectableTeam[]>([]);
  const [selectiveTeamsLoading, setSelectiveTeamsLoading] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [selectiveDays, setSelectiveDays] = useState(7);
  const [selectiveSendNotifications, setSelectiveSendNotifications] = useState(true);
  const [selectiveFetching, setSelectiveFetching] = useState(false);

  const loadSelectiveLeagues = useCallback(async () => {
    const r = await fetch("/api/admin/leagues");
    if (!r.ok) throw new Error("Failed to load leagues");
    return (await r.json()) as LeagueOption[];
  }, []);
  const { data: selectiveLeagues, loading: selectiveLeaguesLoading } = useApiResource(
    loadSelectiveLeagues,
    [] as LeagueOption[],
    "Failed to load leagues.",
  );
  const activeSelectiveLeagues = selectiveLeagues.filter(l => l.isActive);

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

  // TEMPORARY: fetch next calendar month's fixtures — remove once the
  // TheSportsDB provider switch is verified.
  async function fetchNextMonth() {
    setFetchingNextMonth(true);
    const r = await fetch("/api/admin/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch-next-month" }) });
    if (r.ok) {
      const data = await r.json();
      toast.success(`Added ${data.inserted} matches (${data.skipped} already existed)`);
      await loadMatches();
    } else {
      await toastApiError(r, "Failed to fetch next month's matches");
    }
    setFetchingNextMonth(false);
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

  async function createCustomMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!customHome.trim() || !customAway.trim() || !customKickoff) {
      toast.error("All fields are required");
      return;
    }
    setCreatingCustom(true);
    const r = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-custom", homeTeamName: customHome, awayTeamName: customAway, kickoffTime: customKickoff }),
    });
    if (r.ok) {
      toast.success("Custom match created");
      setCustomHome("");
      setCustomAway("");
      setCustomKickoff("");
      setShowCustomForm(false);
      await loadMatches();
    } else {
      await toastApiError(r, "Failed to create match");
    }
    setCreatingCustom(false);
  }

  async function loadSelectiveTeams(leagueId: string) {
    setSelectiveTeamsLoading(true);
    const r = await fetch(`/api/admin/teams?leagueId=${leagueId}`);
    if (r.ok) {
      const data = (await r.json()) as SelectableTeam[];
      setSelectiveTeams(data.filter(t => t.isActive));
    } else {
      await toastApiError(r, "Failed to load teams");
    }
    setSelectiveTeamsLoading(false);
  }

  function handleSelectiveLeagueChange(leagueId: string) {
    setSelectiveLeagueId(leagueId);
    setSelectiveTeams([]);
    setSelectedTeamIds(new Set());
    if (leagueId) loadSelectiveTeams(leagueId);
  }

  function toggleSelectiveTeam(externalId: number) {
    const key = String(externalId);
    setSelectedTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function submitSelectiveFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectiveLeagueId || selectedTeamIds.size === 0) {
      toast.error("Select a league and at least one team");
      return;
    }
    setSelectiveFetching(true);
    const r = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "fetch-selective",
        leagueId: selectiveLeagueId,
        teamIds: selectiveTeams.filter(t => selectedTeamIds.has(String(t.externalId)) && t._id).map(t => t._id),
        days: selectiveDays,
        sendNotifications: selectiveSendNotifications,
      }),
    });
    if (r.ok) {
      const data = await r.json();
      toast.success(`Added ${data.inserted} matches (${data.skipped} already existed)`);
      await loadMatches();
    } else {
      await toastApiError(r, "Failed to fetch selected matches");
    }
    setSelectiveFetching(false);
  }

  const visibleMatches = [...matches].sort(
    (a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime()
  );

  const allSelected = visibleMatches.length > 0 && visibleMatches.every(m => selected.has(m._id));
  const someSelected = selected.size > 0;

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
          {/* TEMPORARY: remove once the TheSportsDB provider switch is verified */}
          <Button variant="outline" onClick={fetchNextMonth} disabled={fetchingNextMonth}>
            {fetchingNextMonth ? "Fetching..." : "Fetch Next Month"}
          </Button>
        </div>
      </div>

      {/* Custom match form */}
      <Card>
        <CardContent className="pt-4">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium w-full text-left"
            onClick={() => setShowCustomForm(v => !v)}
          >
            <Plus className="h-4 w-4" />
            Add Custom Match
            {showCustomForm ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
          </button>
          {showCustomForm && (
            <form onSubmit={createCustomMatch} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="custom-home">Home Team</Label>
                  <Input
                    id="custom-home"
                    placeholder="e.g. Algeria"
                    value={customHome}
                    onChange={e => setCustomHome(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-away">Away Team</Label>
                  <Input
                    id="custom-away"
                    placeholder="e.g. Morocco"
                    value={customAway}
                    onChange={e => setCustomAway(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="custom-kickoff">Kickoff Time</Label>
                <Input
                  id="custom-kickoff"
                  type="datetime-local"
                  value={customKickoff}
                  onChange={e => setCustomKickoff(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={creatingCustom} className="w-full">
                {creatingCustom ? "Creating..." : "Create Match"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Selective fetch form: league + teams + days + notify */}
      <Card>
        <CardContent className="pt-4">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-medium w-full text-left"
            onClick={() => setShowSelectiveForm(v => !v)}
          >
            <ListFilter className="h-4 w-4" />
            Selective Fetch
            {showSelectiveForm ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
          </button>
          {showSelectiveForm && (
            <form onSubmit={submitSelectiveFetch} className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="selective-league">League</Label>
                {selectiveLeaguesLoading ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <select
                    id="selective-league"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectiveLeagueId}
                    onChange={e => handleSelectiveLeagueChange(e.target.value)}
                  >
                    <option value="">Select a league...</option>
                    {activeSelectiveLeagues.map(l => (
                      <option key={l._id} value={l._id}>{l.name} ({l.country} · {l.season})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <Label>Teams</Label>
                {!selectiveLeagueId ? (
                  <p className="text-sm text-muted-foreground">Select a league to view its active teams.</p>
                ) : selectiveTeamsLoading ? (
                  <Skeleton className="h-24 w-full rounded-md" />
                ) : selectiveTeams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active teams in this league.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                    {selectiveTeams.map(team => (
                      <label
                        key={team.externalId}
                        className="flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm select-none hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamIds.has(String(team.externalId))}
                          onChange={() => toggleSelectiveTeam(team.externalId)}
                          className="h-4 w-4 rounded border-input"
                        />
                        {team.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="selective-days">Days ahead</Label>
                <Input
                  id="selective-days"
                  type="number"
                  min={1}
                  value={selectiveDays}
                  onChange={e => setSelectiveDays(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>

              <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectiveSendNotifications}
                  onChange={e => setSelectiveSendNotifications(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Send new game notifications
              </label>

              <Button type="submit" disabled={selectiveFetching} className="w-full">
                {selectiveFetching ? "Fetching..." : "Fetch Selected"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

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
                    <p className="font-medium text-sm">
                      {match.homeTeam.name} vs {match.awayTeam.name}
                      {match.externalId === null && (
                        <span className="ml-2 text-xs text-muted-foreground">(custom)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground"><KickoffTime date={match.kickoffTime} /></p>
                    {match.result && (
                      <p className="text-xs text-muted-foreground">Result: {match.result.homeScore}–{match.result.awayScore}</p>
                    )}
                    {ODDS_FEATURE_ENABLED && match.odds && (
                      <div className="mt-1.5 flex items-center gap-3 text-xs">
                        {match.odds.locked && (
                          <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        <OddsCell label="H" votes={match.odds.homeWinVotes} odds={match.odds.homeWinOdds} total={match.odds.totalVotes} />
                        <OddsCell label="D" votes={match.odds.drawVotes} odds={match.odds.drawOdds} total={match.odds.totalVotes} />
                        <OddsCell label="A" votes={match.odds.awayWinVotes} odds={match.odds.awayWinOdds} total={match.odds.totalVotes} />
                        <span className="text-muted-foreground/50">· {match.odds.totalVotes} vote{match.odds.totalVotes !== 1 ? "s" : ""}</span>
                      </div>
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
