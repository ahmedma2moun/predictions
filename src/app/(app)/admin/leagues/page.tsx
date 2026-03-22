"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminLeaguesPage() {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  async function loadLeagues() {
    const r = await fetch("/api/admin/leagues");
    setLeagues(await r.json());
    setLoading(false);
  }

  useEffect(() => { loadLeagues(); }, []);

  async function fetchFromApi() {
    setFetching(true);
    const r = await fetch("/api/admin/leagues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetch" }) });
    const data = await r.json();
    toast.success(`Synced ${data.synced} leagues`);
    await loadLeagues();
    setFetching(false);
  }

  async function toggleLeague(id: string, isActive: boolean) {
    await fetch("/api/admin/leagues", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isActive }) });
    setLeagues(prev => prev.map(l => l._id === id ? { ...l, isActive } : l));
    if (isActive) toast.success("League activated");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Leagues</h2>
        <Button onClick={fetchFromApi} disabled={fetching}>
          {fetching ? "Fetching..." : "Fetch from API"}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-2">
          {loading ? <p className="text-muted-foreground">Loading...</p> : leagues.length === 0 ? (
            <p className="text-muted-foreground">No leagues. Click "Fetch from API" to load leagues.</p>
          ) : (
            leagues.map(league => (
              <div key={league._id} className="flex items-center justify-between p-3 rounded-lg bg-accent">
                <div className="flex items-center gap-3">
                  {league.logo && <img src={league.logo} alt="" className="h-6 w-6 object-contain" />}
                  <div>
                    <p className="font-medium text-sm">{league.name}</p>
                    <p className="text-xs text-muted-foreground">{league.country} · {league.season}</p>
                  </div>
                </div>
                <Switch checked={league.isActive} onCheckedChange={v => toggleLeague(league._id, v)} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
