import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { RuleBreakdown } from "@/components/ScoringBreakdown";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  totalPoints: number;
  predictionsCount: number;
  accuracy: number;
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

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Week = Friday 00:00 to next Friday 00:00 (local time). */
function getWeekBounds(offset: number): { from: Date; to: Date } {
  const now = new Date();
  const daysSinceFriday = (now.getDay() - 5 + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() - daysSinceFriday + offset * 7);
  friday.setHours(0, 0, 0, 0);
  const nextFriday = new Date(friday);
  nextFriday.setDate(friday.getDate() + 7);
  return { from: friday, to: nextFriday };
}

/** Month = first day of month 00:00 to first day of next month 00:00 (local). */
function getMonthBounds(offset: number): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from, to };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLeaderboard() {
  const { data: session } = useSession();

  const [period, setPeriod]           = useState("all");
  const [weekOffset, setWeekOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

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

  const getDateRange = useCallback((): { from: Date; to: Date } | null => {
    if (period === "week")  return getWeekBounds(weekOffset);
    if (period === "month") return getMonthBounds(monthOffset);
    return null;
  }, [period, weekOffset, monthOffset]);

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
  }, [period, weekOffset, monthOffset, groupId, selectedLeagues]);

  // Fetch leaderboard
  useEffect(() => {
    if (!groupsReady) return;

    const range    = getDateRange();
    const fromStr  = range ? range.from.toISOString() : "";
    const toStr    = range ? range.to.toISOString()   : "";
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
    if (range) url += `&from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`;
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
  }, [period, weekOffset, monthOffset, groupId, selectedLeagues, groupsReady, getDateRange]);

  async function toggleUser(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }

    const range    = getDateRange();
    const fromStr  = range ? range.from.toISOString() : "";
    const toStr    = range ? range.to.toISOString()   : "";
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
    if (range) url += `&from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`;
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

  // Computed labels
  const weekLabel = (() => {
    const { from, to } = getWeekBounds(weekOffset);
    const thursdayEnd = new Date(to);
    thursdayEnd.setDate(to.getDate() - 1);
    return `${fmtDate(from)} – ${fmtDate(thursdayEnd)}`;
  })();

  const monthLabel = fmtMonthYear(getMonthBounds(monthOffset).from);

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
