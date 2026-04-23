import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { RuleBreakdown } from "@/components/ScoringBreakdown";
import { usePeriodFilter } from "@/hooks/usePeriodFilter";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  totalPoints: number;
  predictionsCount: number;
  accuracy: number;
  currentStreak: number;
  badges: string[];
};

export type Group = { id: string; name: string; isDefault: boolean };

export type League = { id: string; externalId: number; name: string; country: string; logo?: string };

export type UserPrediction = {
  matchId: string;
  kickoffTime: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  result: { homeScore: number; awayScore: number };
  pointsAwarded: number;
  scoringBreakdown: RuleBreakdown[] | null;
};

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
type LbCacheEntry = { data: LeaderboardEntry[]; ts: number };
type UpCacheEntry = { data: UserPrediction[]; ts: number };

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLeaderboard() {
  const { data: session } = useSession();

  const {
    period, setPeriod,
    weekOffset, setWeekOffset,
    monthOffset, setMonthOffset,
    weekLabel, monthLabel,
    dateRange,
  } = usePeriodFilter();

  const [groups, setGroups]           = useState<Group[]>([]);
  const [groupId, setGroupId]         = useState<string | null>(null);
  const [groupsReady, setGroupsReady] = useState(false);

  const [leagues, setLeagues]                   = useState<League[]>([]);
  const [selectedLeagues, setSelectedLeagues]   = useState<string[]>([]);
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);
  const leagueDropdownRef = useRef<HTMLDivElement>(null);

  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [loadingUserId, setLoadingUserId]   = useState<string | null>(null);

  const lbCache = useRef<Record<string, LbCacheEntry>>({});
  const upCache = useRef<Record<string, UpCacheEntry>>({});
  const upData  = useRef<Record<string, UserPrediction[]>>({});

  // Load groups
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

  // Load leagues
  useEffect(() => {
    fetch("/api/leagues")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: League[]) => setLeagues(data))
      .catch(() => {});
  }, []);

  // Close league dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (leagueDropdownRef.current && !leagueDropdownRef.current.contains(e.target as Node)) {
        setLeagueDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Collapse expanded row when filters change
  useEffect(() => {
    setExpandedUserId(null);
  }, [dateRange, groupId, selectedLeagues]);

  // Fetch leaderboard
  useEffect(() => {
    if (!groupsReady) return;

    const fromStr   = dateRange ? dateRange.from.toISOString() : "";
    const toStr     = dateRange ? dateRange.to.toISOString()   : "";
    const leagueKey = selectedLeagues.slice().sort().join(",");
    const cacheKey  = `${fromStr}:${toStr}:${groupId ?? "all"}:${leagueKey}`;

    const cached = lbCache.current[cacheKey];
    const now    = Date.now();

    if (cached && now - cached.ts < CACHE_TTL_MS) {
      setLeaderboard(cached.data);
      setIsLoading(false);
      setIsRefreshing(true);
    } else {
      setLeaderboard([]);
      setIsLoading(true);
    }

    let url = `/api/leaderboard?period=${period}`;
    if (dateRange) url += `&from=${encodeURIComponent(dateRange.from.toISOString())}&to=${encodeURIComponent(dateRange.to.toISOString())}`;
    if (groupId) url += `&groupId=${groupId}`;
    for (const lid of selectedLeagues) url += `&leagueId=${lid}`;

    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: LeaderboardEntry[]) => {
        lbCache.current[cacheKey] = { data, ts: Date.now() };
        setLeaderboard(data);
        setIsLoading(false);
        setIsRefreshing(false);
      })
      .catch(() => { setIsLoading(false); setIsRefreshing(false); });
  }, [period, dateRange, groupId, selectedLeagues, groupsReady]);

  async function toggleUser(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }

    const fromStr   = dateRange ? dateRange.from.toISOString() : "";
    const toStr     = dateRange ? dateRange.to.toISOString()   : "";
    const leagueKey = selectedLeagues.slice().sort().join(",");
    const cacheKey  = `${userId}:${fromStr}:${toStr}:${leagueKey}`;

    if (upCache.current[cacheKey] && Date.now() - upCache.current[cacheKey].ts < CACHE_TTL_MS) {
      upData.current[userId] = upCache.current[cacheKey].data;
      setExpandedUserId(userId);
      return;
    }

    setLoadingUserId(userId);
    setExpandedUserId(userId);

    let url = `/api/leaderboard/user-predictions?userId=${userId}`;
    if (dateRange) url += `&from=${encodeURIComponent(dateRange.from.toISOString())}&to=${encodeURIComponent(dateRange.to.toISOString())}`;
    for (const lid of selectedLeagues) url += `&leagueId=${lid}`;

    try {
      const res  = await fetch(url);
      const data: UserPrediction[] = await res.json();
      upCache.current[cacheKey] = { data, ts: Date.now() };
      upData.current[userId] = data;
    } catch {
      upData.current[userId] = [];
    } finally {
      setLoadingUserId(null);
    }
  }

  const myId = (session?.user as { id?: string } | undefined)?.id;

  return {
    period, setPeriod,
    weekOffset, setWeekOffset,
    monthOffset, setMonthOffset,
    groups, groupId, setGroupId,
    leagues, selectedLeagues, setSelectedLeagues,
    leagueDropdownOpen, setLeagueDropdownOpen, leagueDropdownRef,
    leaderboard, isLoading, isRefreshing,
    expandedUserId, loadingUserId,
    upData,
    toggleUser,
    weekLabel,
    monthLabel,
    myId,
  };
}
