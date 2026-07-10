import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LiveMovement = "up" | "down" | "same";

export type LiveStandingMatch = {
  matchId: string;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
  homeScore: number;
  awayScore: number;
  status: "live" | "finished";
  kickoffTime: string;
};

export type LiveStandingEntry = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  previousRank: number;
  rank: number;
  movement: LiveMovement;
  points: number;
  livePoints: number;
  liveTotalPoints: number;
};

export type LiveGroupStanding = {
  hasLiveMatches: boolean;
  matches: LiveStandingMatch[];
  standings: LiveStandingEntry[];
};

export type Group = { id: string; name: string; isDefault: boolean };

const POLL_INTERVAL_MS = 60_000;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveStanding() {
  const { data: session } = useSession();

  const [groups, setGroups]           = useState<Group[]>([]);
  const [groupId, setGroupId]         = useState<string | null>(null);
  const [groupsReady, setGroupsReady] = useState(false);

  const [data, setData]               = useState<LiveGroupStanding | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [offSeason, setOffSeason]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load groups (same ordering as the leaderboard: custom groups first)
  useEffect(() => {
    fetch("/api/groups")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: Group[]) => {
        const sorted = [...data.filter(g => !g.isDefault), ...data.filter(g => g.isDefault)];
        setGroups(sorted);
        if (sorted.length > 0) setGroupId(sorted[0].id);
        setGroupsReady(true);
      })
      .catch(() => setGroupsReady(true));
  }, []);

  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  // Fetch + poll the live standing
  useEffect(() => {
    if (!groupsReady) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load(initial: boolean) {
      if (initial) setIsLoading(true);
      else setIsRefreshing(true);

      let url = "/api/leaderboard/live";
      if (groupIdRef.current) url += `?groupId=${groupIdRef.current}`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        setOffSeason(res.headers.get("x-season-status") === "off");
        const json: LiveGroupStanding = await res.json();
        if (cancelled) return;
        setData(json);
        setLastUpdated(new Date());
      } catch {
        // keep the previous data on transient errors
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
          timer = setTimeout(() => load(false), POLL_INTERVAL_MS);
        }
      }
    }

    load(true);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [groupsReady, groupId]);

  const myId = (session?.user as { id?: string } | undefined)?.id;

  return {
    groups, groupId, setGroupId,
    data, isLoading, isRefreshing,
    offSeason, lastUpdated,
    myId,
  };
}
