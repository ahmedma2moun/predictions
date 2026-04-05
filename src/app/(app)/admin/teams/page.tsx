"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function AdminTeamsPage() {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/leagues")
      .then(r => r.json())
      .then(data => setLeagues(data));
  }, []);

  async function loadTeams(leagueId: string) {
    setLoading(true);
    const r = await fetch(`/api/admin/teams?leagueId=${leagueId}`);
    setTeams(await r.json());
    setLoading(false);
  }

  function handleLeagueChange(leagueId: string) {
    setSelectedLeagueId(leagueId);
    setTeams([]);
    setSearch("");
    if (leagueId) loadTeams(leagueId);
  }

  async function fetchFromApi() {
    if (!selectedLeagueId) return;
    setFetching(true);
    const r = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueId: selectedLeagueId }),
    });
    const data = await r.json();
    setTeams(data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
    toast.success(`Loaded ${data.length} teams from API`);
    setFetching(false);
  }

  async function toggleTeam(team: any, isActive: boolean) {
    const r = await fetch("/api/admin/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...team, isActive }),
    });
    const data = await r.json();
    setTeams(prev => prev.map(t =>
      t.externalId === team.externalId
        ? { ...t, isActive, _id: isActive ? data._id : null }
        : t
    ));
    toast.success(isActive ? "Team activated" : "Team removed");
  }

  const filtered = teams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const allActive = filtered.length > 0 && filtered.every(t => t.isActive);
  const someActive = filtered.some(t => t.isActive);

  async function selectAll(activate: boolean) {
    if (!filtered.length) return;
    setBulkLoading(true);
    const ops = filtered
      .filter(t => !!t.isActive !== activate)
      .map(team => toggleTeam(team, activate));
    await Promise.all(ops);
    toast.success(activate ? `Activated all ${filtered.length} teams` : `Deactivated all ${filtered.length} teams`);
    setBulkLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Teams</h2>
        <Button onClick={fetchFromApi} disabled={fetching || !selectedLeagueId}>
          {fetching ? "Fetching..." : "Fetch from API"}
        </Button>
      </div>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={selectedLeagueId}
        onChange={e => handleLeagueChange(e.target.value)}
      >
        <option value="">Select a league...</option>
        {leagues.map(l => (
          <option key={l._id} value={l._id}>{l.name} ({l.country} · {l.season})</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Search teams..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Card>
        <CardContent className="pt-4 space-y-2">
          {!selectedLeagueId ? (
            <p className="text-muted-foreground">Select a league to view its teams.</p>
          ) : loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">
              {teams.length === 0
                ? 'No teams. Click "Fetch from API" to load all teams for this league.'
                : "No teams match your search."}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <span className="text-sm text-muted-foreground">{filtered.length} team{filtered.length !== 1 ? "s" : ""}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkLoading || allActive}
                    onClick={() => selectAll(true)}
                  >
                    Activate All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkLoading || !someActive}
                    onClick={() => selectAll(false)}
                  >
                    Deactivate All
                  </Button>
                </div>
              </div>
            {filtered.map(team => (
              <div key={team.externalId} className="flex items-center justify-between p-3 rounded-lg bg-accent">
                <div className="flex items-center gap-3">
                  {team.logo && <img src={team.logo} alt="" className="h-6 w-6 object-contain" />}
                  <p className="font-medium text-sm">{team.name}</p>
                </div>
                <Switch checked={!!team.isActive} onCheckedChange={v => toggleTeam(team, v)} />
              </div>
            ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
