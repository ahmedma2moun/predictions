"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SeasonStatus = "DRAFT" | "ACTIVE" | "ENDED";

type Season = {
  id: string;
  name: string;
  description: string | null;
  status: SeasonStatus;
  startDate: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  oddsEnabled: boolean;
  oddsMin: number;
  oddsMax: number;
};

type PreviewEntry = {
  rank: number;
  userId: number;
  userName: string | null;
  totalPoints: number;
  groupId: number | null;
  groupName?: string;
};

type Preview = {
  overall: PreviewEntry[];
  perGroup: Array<PreviewEntry & { groupName: string | null }>;
};

const STATUS_COLORS: Record<SeasonStatus, string> = {
  DRAFT:  "bg-muted text-muted-foreground",
  ACTIVE: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
  ENDED:  "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

const MEDALS = ["🥇", "🥈", "🥉"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function SeasonsAdminClient({ initialSeasons }: { initialSeasons: Season[] }) {
  const [seasons, setSeasons] = useState<Season[]>(initialSeasons);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [oddsEnabled, setOddsEnabled] = useState(false);
  const [oddsMin, setOddsMin] = useState("1.1");
  const [oddsMax, setOddsMax] = useState("5.0");

  // End season confirmation + preview
  const [endingSeasonId, setEndingSeasonId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  function notify(msg: string, isError = false) {
    if (isError) { setError(msg); setSuccess(null); }
    else          { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 4000);
  }

  async function reload() {
    const res = await fetch("/api/admin/seasons");
    if (res.ok) setSeasons(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading("create");
    const res = await fetch("/api/admin/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        startDate,
        oddsEnabled,
        oddsMin: parseFloat(oddsMin),
        oddsMax: parseFloat(oddsMax),
      }),
    });
    setLoading(null);
    if (res.ok) {
      notify("Season created");
      setShowCreate(false);
      setName(""); setDescription(""); setStartDate("");
      setOddsEnabled(false); setOddsMin("1.1"); setOddsMax("5.0");
      await reload();
    } else {
      const d = await res.json();
      notify(d.error ?? "Failed to create season", true);
    }
  }

  async function handleActivate(id: string) {
    setLoading(`activate-${id}`);
    const res = await fetch(`/api/admin/seasons/${id}/activate`, { method: "POST" });
    setLoading(null);
    if (res.ok) {
      const d = await res.json();
      notify(`Season activated — ${d.retroAssigned} matches retro-assigned`);
      await reload();
    } else {
      const d = await res.json();
      notify(d.error ?? "Failed to activate", true);
    }
  }

  async function startEndFlow(id: string) {
    setEndingSeasonId(id);
    setPreview(null);
    setPreviewLoading(true);
    const res = await fetch(`/api/admin/seasons/${id}/preview`);
    setPreviewLoading(false);
    if (res.ok) setPreview(await res.json());
  }

  async function confirmEnd() {
    if (!endingSeasonId) return;
    setLoading(`end-${endingSeasonId}`);
    const res = await fetch(`/api/admin/seasons/${endingSeasonId}/end`, { method: "POST" });
    setLoading(null);
    setEndingSeasonId(null);
    setPreview(null);
    if (res.ok) {
      notify("Season ended — notifications sent to all users");
      await reload();
    } else {
      const d = await res.json();
      notify(d.error ?? "Failed to end season", true);
    }
  }

  async function handleRetroAssign(id: string) {
    setLoading(`retro-${id}`);
    const res = await fetch(`/api/admin/seasons/${id}/retro-assign`, { method: "POST" });
    setLoading(null);
    if (res.ok) {
      const d = await res.json();
      notify(`Retro-assigned ${d.retroAssigned} matches`);
    } else {
      const d = await res.json();
      notify(d.error ?? "Failed", true);
    }
  }

  const activeSeason = seasons.find(s => s.status === "ACTIVE");
  const hasActive = !!activeSeason;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Seasons</h1>
        <Button onClick={() => setShowCreate(v => !v)} variant="outline" size="sm">
          {showCreate ? "Cancel" : "New Season"}
        </Button>
      </div>

      {error   && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>}
      {success && <div className="text-sm text-green-600 bg-green-500/10 px-3 py-2 rounded-md">{success}</div>}

      {showCreate && (
        <Card>
          <CardHeader><CardTitle>Create Season</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name *</label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  placeholder="e.g. Season 1 or Spring 2026"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Start Date *</label>
                <input
                  type="date"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Matches on or after this date will be retro-assigned when you activate.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description (optional)</label>
                <textarea
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none"
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className="border border-border rounded-md p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={oddsEnabled}
                    onChange={e => setOddsEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Enable odds multiplier for this season
                </label>
                {oddsEnabled && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground block mb-1">Min odds</label>
                      <input
                        type="number" step="0.1" min="1.0" max="10"
                        className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                        value={oddsMin}
                        onChange={e => setOddsMin(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground block mb-1">Max odds</label>
                      <input
                        type="number" step="0.1" min="1.0" max="20"
                        className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                        value={oddsMax}
                        onChange={e => setOddsMax(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  When enabled, correct predictions for unpopular outcomes earn more points.
                </p>
              </div>
              <Button type="submit" disabled={loading === "create"}>
                {loading === "create" ? "Creating…" : "Create Season"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* End Season Confirmation Modal */}
      {endingSeasonId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-1">End Season</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This will freeze results, award badges, and send notifications to all users.
            </p>

            {previewLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading preview…</p>
            ) : preview ? (
              <div className="space-y-4 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Overall Champion</p>
                  {preview.overall.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No scored predictions yet</p>
                  ) : (
                    <div className="space-y-1">
                      {preview.overall.map(e => (
                        <div key={e.userId} className="flex items-center gap-2 text-sm">
                          <span>{MEDALS[e.rank - 1]}</span>
                          <span className="font-medium">{e.userName ?? `User ${e.userId}`}</span>
                          <span className="text-muted-foreground ml-auto">{e.totalPoints} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {preview.perGroup.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Group Champions</p>
                    {Object.entries(
                      preview.perGroup.reduce((acc, e) => {
                        const key = e.groupName ?? String(e.groupId);
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(e);
                        return acc;
                      }, {} as Record<string, typeof preview.perGroup>)
                    ).map(([groupName, entries]) => (
                      <div key={groupName} className="mb-2">
                        <p className="text-xs text-muted-foreground mb-1">{groupName}</p>
                        {entries.slice(0, 1).map(e => (
                          <div key={e.userId} className="flex items-center gap-2 text-sm">
                            <span>🥇</span>
                            <span className="font-medium">{e.userName ?? `User ${e.userId}`}</span>
                            <span className="text-muted-foreground ml-auto">{e.totalPoints} pts</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setEndingSeasonId(null); setPreview(null); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmEnd}
                disabled={loading === `end-${endingSeasonId}`}
              >
                {loading === `end-${endingSeasonId}` ? "Ending…" : "Confirm End Season"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Season List */}
      <div className="space-y-3">
        {seasons.length === 0 && (
          <p className="text-muted-foreground text-sm py-4 text-center">No seasons yet. Create one to get started.</p>
        )}
        {seasons.map(season => (
          <Card key={season.id} className={cn(season.status === "ACTIVE" && "border-green-500/40")}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{season.name}</h3>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", STATUS_COLORS[season.status])}>
                      {season.status}
                    </span>
                  </div>
                  {season.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{season.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Starts {formatDate(season.startDate)}
                    {season.endedAt && ` · Ended ${formatDate(season.endedAt)}`}
                    {season.startedAt && !season.endedAt && ` · Activated ${formatDate(season.startedAt)}`}
                    {season.oddsEnabled && ` · Odds ×${season.oddsMin}–×${season.oddsMax}`}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  {season.status === "DRAFT" && (
                    <Button
                      size="sm"
                      onClick={() => handleActivate(season.id)}
                      disabled={!!loading || hasActive}
                      title={hasActive ? `"${activeSeason?.name}" is already active` : undefined}
                    >
                      {loading === `activate-${season.id}` ? "Activating…" : "Activate"}
                    </Button>
                  )}
                  {season.status === "ACTIVE" && (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => startEndFlow(season.id)}
                        disabled={!!loading}
                      >
                        End Season
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetroAssign(season.id)}
                        disabled={!!loading}
                      >
                        {loading === `retro-${season.id}` ? "Assigning…" : "Retro-Assign"}
                      </Button>
                    </>
                  )}
                  {season.status === "ENDED" && (
                    <Badge variant="secondary">Completed</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
