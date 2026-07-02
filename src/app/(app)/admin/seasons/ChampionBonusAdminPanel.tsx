"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

type League = { _id: string; name: string; logo: string | null };
type TeamOption = { _id: string; name: string; logo: string | null };

type AllowedTeam = { teamId: string; name: string; logo: string | null };
type RevealPick = { userId: string; name: string | null; teamId: string; teamName: string; totalBonus: number };

type AdminState =
  | { enabled: false }
  | {
      enabled: true;
      status: "OPEN" | "LOCKED";
      league: { id: string; name: string; logo: string | null };
      lockedAt: string | null;
      allowedTeams: AllowedTeam[];
      pickCount: number;
      picks: RevealPick[];
    };

function notifyFactory(setError: (v: string | null) => void, setSuccess: (v: string | null) => void) {
  return (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(null); }
    else          { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 4000);
  };
}

export function ChampionBonusAdminPanel({ seasonId }: { seasonId: string }) {
  const [state, setState] = useState<AdminState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const notify = notifyFactory(setError, setSuccess);

  // Setup / edit-teams modal
  const [showModal, setShowModal] = useState(false);
  const [editingTeams, setEditingTeams] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Cancel confirmation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/seasons/${seasonId}/champion-bonus`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data) setState(data); });
  }, [seasonId]);

  async function openSetup() {
    setEditingTeams(false);
    setSelectedLeagueId("");
    setTeams([]);
    setSelectedTeamIds(new Set());
    setShowModal(true);
    if (leagues.length === 0) {
      const res = await fetch("/api/admin/leagues");
      if (res.ok) setLeagues(await res.json());
    }
  }

  async function openEditTeams() {
    if (!state?.enabled) return;
    setEditingTeams(true);
    setSelectedLeagueId(state.league.id);
    setSelectedTeamIds(new Set(state.allowedTeams.map(t => t.teamId)));
    setShowModal(true);
    await loadTeamsForLeague(state.league.id);
  }

  async function loadTeamsForLeague(leagueId: string) {
    if (!leagueId) { setTeams([]); return; }
    setTeamsLoading(true);
    const res = await fetch(`/api/admin/teams?leagueId=${leagueId}`);
    setTeamsLoading(false);
    if (res.ok) setTeams(await res.json());
  }

  function toggleTeam(id: string) {
    setSelectedTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!selectedLeagueId || selectedTeamIds.size < 2) {
      notify("Select a league and at least 2 teams", true);
      return;
    }
    setLoading(true);
    const teamIds = [...selectedTeamIds].map(Number);
    const res = editingTeams
      ? await fetch(`/api/admin/seasons/${seasonId}/champion-bonus`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamIds }),
        })
      : await fetch(`/api/admin/seasons/${seasonId}/champion-bonus`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueId: Number(selectedLeagueId), teamIds }),
        });
    setLoading(false);
    if (res.ok) {
      setState(await res.json());
      setShowModal(false);
      notify(editingTeams ? "Allowed teams updated" : "Champion Bonus enabled");
    } else {
      const d = await res.json();
      notify(d.error ?? "Failed", true);
    }
  }

  async function handleLock() {
    setLoading(true);
    const res = await fetch(`/api/admin/seasons/${seasonId}/champion-bonus/lock`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      setState(await res.json());
      notify("Picks locked — games from now on count");
    } else {
      const d = await res.json();
      notify(d.error ?? "Failed to lock", true);
    }
  }

  async function handleCancel() {
    setLoading(true);
    const res = await fetch(`/api/admin/seasons/${seasonId}/champion-bonus`, { method: "DELETE" });
    setLoading(false);
    setShowCancelConfirm(false);
    if (res.ok) {
      setState(await res.json());
      notify("Champion Bonus cancelled — bonus points removed from the leaderboard");
    } else {
      const d = await res.json();
      notify(d.error ?? "Failed to cancel", true);
    }
  }

  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const pickCount = state?.enabled ? state.pickCount : 0;
  const totalPoints = state?.enabled ? state.picks.reduce((s, p) => s + p.totalBonus, 0) : 0;

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <Crown className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold">Champion Bonus</span>
        {state?.enabled && (
          <span className={
            state.status === "OPEN"
              ? "text-xs px-2 py-0.5 rounded-full border font-medium bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30"
              : "text-xs px-2 py-0.5 rounded-full border font-medium bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30"
          }>
            {state.status}
          </span>
        )}
      </div>

      {error   && <div className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded-md mb-2">{error}</div>}
      {success && <div className="text-xs text-green-600 bg-green-500/10 px-2 py-1.5 rounded-md mb-2">{success}</div>}

      {!state ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : !state.enabled ? (
        <Button size="sm" variant="outline" onClick={openSetup}>Set up Champion Bonus</Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {state.league.name} · {state.allowedTeams.length} allowed team{state.allowedTeams.length !== 1 ? "s" : ""} · {pickCount} pick{pickCount !== 1 ? "s" : ""}
            {state.status === "LOCKED" && ` · locked ${new Date(state.lockedAt!).toLocaleString()}`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {state.allowedTeams.map(t => (
              <span key={t.teamId} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border">
                {t.name}
              </span>
            ))}
          </div>

          {state.status === "LOCKED" && state.picks.length > 0 && (
            <div className="space-y-1 pt-1">
              {state.picks.map(p => (
                <div key={p.userId} className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{p.name ?? `User ${p.userId}`}</span>
                  <span className="text-muted-foreground">→ {p.teamName}</span>
                  <span className="ml-auto font-semibold">+{p.totalBonus} pts</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {state.status === "OPEN" && (
              <>
                <Button size="sm" variant="outline" onClick={openEditTeams} disabled={loading}>Edit teams</Button>
                <Button size="sm" onClick={handleLock} disabled={loading}>
                  {loading ? "Locking…" : "Lock picks"}
                </Button>
              </>
            )}
            <Button size="sm" variant="destructive" onClick={() => setShowCancelConfirm(true)} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Setup / Edit teams modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">{editingTeams ? "Edit Allowed Teams" : "Set Up Champion Bonus"}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a league, then check the teams users may pick as their champion.
            </p>

            {!editingTeams && (
              <div className="mb-3">
                <label className="text-sm font-medium block mb-1">League</label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={selectedLeagueId}
                  onChange={e => { setSelectedLeagueId(e.target.value); setSelectedTeamIds(new Set()); loadTeamsForLeague(e.target.value); }}
                >
                  <option value="">Select a league…</option>
                  {leagues.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </div>
            )}

            {selectedLeagueId && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background"
                    placeholder="Search teams…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedTeamIds(new Set(teams.map(t => t._id)))}>
                    Select all
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedTeamIds(new Set())}>
                    Clear
                  </Button>
                </div>

                {teamsLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading teams…</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto border border-border rounded-md p-2">
                    {filteredTeams.map(t => (
                      <label key={t._id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTeamIds.has(t._id)}
                          onChange={() => toggleTeam(t._id)}
                          className="h-4 w-4"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {t.logo && <img src={t.logo} alt="" className="h-4 w-4 object-contain" />}
                        <span className="truncate">{t.name}</span>
                      </label>
                    ))}
                    {filteredTeams.length === 0 && (
                      <p className="text-xs text-muted-foreground col-span-2 text-center py-2">No teams found</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{selectedTeamIds.size} selected</p>
              </>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={loading || !selectedLeagueId || selectedTeamIds.size < 2}>
                {loading ? "Saving…" : editingTeams ? "Save Teams" : "Enable"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {showCancelConfirm && state?.enabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-1">Cancel Champion Bonus?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This removes ALL bonus points from the leaderboard — deletes {pickCount} pick{pickCount !== 1 ? "s" : ""} and {totalPoints} point{totalPoints !== 1 ? "s" : ""} earned so far. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>Keep it</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={loading}>
                {loading ? "Cancelling…" : "Cancel Champion Bonus"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
