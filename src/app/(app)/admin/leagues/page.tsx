"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function AdminLeaguesPage() {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    fetch("/api/admin/leagues")
      .then(r => r.json())
      .then(data => { setLeagues(data); setLoading(false); });
  }, []);

  async function fetchFromApi() {
    setFetching(true);
    const r = await fetch("/api/admin/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fetch" }),
    });
    const data = await r.json();
    setLeagues(data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
    toast.success(`Loaded ${data.length} leagues from API`);
    setFetching(false);
  }

  async function toggleLeague(league: any, isActive: boolean) {
    const r = await fetch("/api/admin/leagues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...league, isActive }),
    });
    const data = await r.json();
    setLeagues(prev => prev.map(l =>
      l.externalId === league.externalId
        ? { ...l, isActive, _id: isActive ? data._id : null }
        : l
    ));
    toast.success(isActive ? "League activated" : "League removed");
  }

  const filtered = leagues.filter(l =>
    `${l.name} ${l.country}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Leagues</h2>
        <Button onClick={fetchFromApi} disabled={fetching}>
          {fetching ? "Fetching..." : "Fetch from API"}
        </Button>
      </div>
      <input
        type="text"
        placeholder="Search leagues..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Card>
        <CardContent className="pt-4 space-y-2">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">
              {leagues.length === 0
                ? 'No leagues. Click "Fetch from API" to load all available leagues.'
                : "No leagues match your search."}
            </p>
          ) : (
            filtered.map(league => (
              <div key={league.externalId} className="flex items-center justify-between p-3 rounded-lg bg-accent">
                <div className="flex items-center gap-3">
                  {league.logo && <img src={league.logo} alt="" className="h-6 w-6 object-contain" />}
                  <div>
                    <p className="font-medium text-sm">{league.name}</p>
                    <p className="text-xs text-muted-foreground">{league.country} · {league.season}</p>
                  </div>
                </div>
                <Switch checked={!!league.isActive} onCheckedChange={v => toggleLeague(league, v)} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
