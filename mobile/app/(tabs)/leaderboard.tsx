import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { Colors } from '@/lib/constants';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────

type LeaderboardEntry = {
  rank:             number;
  userId:           string;
  name:             string;
  avatarUrl?:       string | null;
  totalPoints:      number;
  predictionsCount: number;
  accuracy:         number;
};

type Group = { id: string; name: string; isDefault: boolean };

type UserPrediction = {
  matchId:      string;
  kickoffTime:  string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore:    number;
  awayScore:    number;
  result:       { homeScore: number; awayScore: number };
  pointsAwarded:    number;
  scoringBreakdown: { key: string; name: string; points: number; awarded: boolean }[] | null;
};

type Period = 'all' | 'month' | 'week';

// ── Date helpers ───────────────────────────────────────────────────────────────

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

function getMonthBounds(offset: number): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from, to };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Avatar initials ────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <View style={[av.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.text, { fontSize: size * 0.33 }]}>{initials}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  circle: { backgroundColor: Colors.muted, alignItems: 'center', justifyContent: 'center' },
  text:   { color: Colors.textMuted, fontWeight: '700' },
});

// ── Rank medal ─────────────────────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉'];

function RankLabel({ rank }: { rank: number }) {
  if (rank <= 3) return <Text style={{ fontSize: 18 }}>{MEDALS[rank - 1]}</Text>;
  return <Text style={rl.num}>{rank}</Text>;
}
const rl = StyleSheet.create({
  num: { width: 24, textAlign: 'center', fontSize: 13, fontWeight: '700', color: Colors.textMuted },
});

// ── User predictions panel ─────────────────────────────────────────────────────

function UserPredictionPanel({ preds }: { preds: UserPrediction[] }) {
  if (preds.length === 0) {
    return <Text style={up.empty}>No scored predictions in this period.</Text>;
  }
  return (
    <View style={up.container}>
      {preds.map((p) => (
        <View key={p.matchId} style={up.row}>
          <View style={up.rowTop}>
            <Text style={up.matchName} numberOfLines={1}>
              {p.homeTeamName} vs {p.awayTeamName}
            </Text>
            <View style={[up.badge, p.pointsAwarded > 0 ? up.badgePositive : up.badgeZero]}>
              <Text style={[up.badgeText, p.pointsAwarded > 0 && up.badgeTextPositive]}>
                +{p.pointsAwarded} pts
              </Text>
            </View>
          </View>
          <View style={up.rowBottom}>
            <Text style={up.meta}>{formatKickoff(p.kickoffTime)}</Text>
            <Text style={up.meta}>
              Pick: <Text style={up.score}>{p.homeScore}–{p.awayScore}</Text>
            </Text>
            <Text style={up.meta}>
              Result: <Text style={up.score}>{p.result.homeScore}–{p.result.awayScore}</Text>
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
const up = StyleSheet.create({
  container: { marginTop: 8, gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  row:       { backgroundColor: Colors.muted, borderRadius: 8, padding: 10, gap: 4 },
  rowTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  matchName: { flex: 1, fontSize: 11, fontWeight: '600', color: Colors.text },
  badge:     { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgePositive: { backgroundColor: Colors.primary },
  badgeZero:     { backgroundColor: Colors.muted, borderWidth: 1, borderColor: Colors.border },
  badgeText:     { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  badgeTextPositive: { color: Colors.bg },
  rowBottom: { flexDirection: 'row', gap: 10 },
  meta:      { fontSize: 10, color: Colors.textMuted },
  score:     { color: Colors.text, fontWeight: '600' },
  empty:     { fontSize: 11, color: Colors.textMuted, textAlign: 'center', paddingVertical: 4 },
});

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_TTL = 60_000;
type CacheEntry<T> = { data: T; ts: number };

// ── Main screen ────────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const [myId, setMyId] = useState<string | null>(null);

  const [period,      setPeriod]      = useState<Period>('all');
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [groups,     setGroups]     = useState<Group[]>([]);
  const [groupId,    setGroupId]    = useState<string | null>(null);
  const [groupsReady, setGroupsReady] = useState(false);

  const [leaderboard,  setLeaderboard]  = useState<LeaderboardEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [loadingUser, setLoadingUser]  = useState<string | null>(null);

  const lbCache  = useRef<Record<string, CacheEntry<LeaderboardEntry[]>>>({});
  const upCache  = useRef<Record<string, CacheEntry<UserPrediction[]>>>({});
  const upData   = useRef<Record<string, UserPrediction[]>>({});

  // Load current user ID
  useEffect(() => {
    getUser().then((u) => setMyId(u?.id ?? null));
  }, []);

  // Load groups once
  useEffect(() => {
    api.get<Group[]>('/api/mobile/groups')
      .then((res) => {
        const sorted = [...res.data.filter(g => !g.isDefault), ...res.data.filter(g => g.isDefault)];
        setGroups(sorted);
        const def = res.data.find(g => g.isDefault);
        if (def) setGroupId(def.id);
      })
      .catch(() => {})
      .finally(() => setGroupsReady(true));
  }, []);

  // Date range helpers
  const getDateRange = useCallback((): { from: Date; to: Date } | null => {
    if (period === 'week')  return getWeekBounds(weekOffset);
    if (period === 'month') return getMonthBounds(monthOffset);
    return null;
  }, [period, weekOffset, monthOffset]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async (isRefresh = false) => {
    if (!groupsReady) return;
    const range = getDateRange();
    const cacheKey = `${range?.from.toISOString() ?? ''}:${range?.to.toISOString() ?? ''}:${groupId ?? 'all'}`;

    const cached = lbCache.current[cacheKey];
    if (!isRefresh && cached && Date.now() - cached.ts < CACHE_TTL) {
      setLeaderboard(cached.data);
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);

    let url = `/api/mobile/leaderboard?period=${period}`;
    if (range) url += `&from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`;
    if (groupId) url += `&groupId=${groupId}`;

    try {
      const res = await api.get<LeaderboardEntry[]>(url);
      lbCache.current[cacheKey] = { data: res.data, ts: Date.now() };
      setLeaderboard(res.data);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupsReady, groupId, period, getDateRange]);

  useEffect(() => {
    setExpandedId(null);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchLeaderboard(true);
  }

  // Toggle per-user prediction panel
  async function toggleUser(userId: string) {
    if (expandedId === userId) { setExpandedId(null); return; }

    const range = getDateRange();
    const cacheKey = `${userId}:${range?.from.toISOString() ?? ''}:${range?.to.toISOString() ?? ''}`;

    if (upCache.current[cacheKey] && Date.now() - upCache.current[cacheKey].ts < CACHE_TTL) {
      upData.current[userId] = upCache.current[cacheKey].data;
      setExpandedId(userId);
      return;
    }

    setLoadingUser(userId);
    setExpandedId(userId);

    let url = `/api/mobile/leaderboard/user-predictions?userId=${userId}`;
    if (range) {
      url += `&from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`;
    }

    try {
      const res = await api.get<UserPrediction[]>(url);
      upCache.current[cacheKey] = { data: res.data, ts: Date.now() };
      upData.current[userId] = res.data;
    } catch {
      upData.current[userId] = [];
    } finally {
      setLoadingUser(null);
    }
  }

  // Navigation labels
  function weekLabel(): string {
    const { from, to } = getWeekBounds(weekOffset);
    const thursdayEnd = new Date(to);
    thursdayEnd.setDate(to.getDate() - 1);
    return `${fmtDate(from)} – ${fmtDate(thursdayEnd)}`;
  }
  function monthLabel(): string { return fmtMonthYear(getMonthBounds(monthOffset).from); }

  // Render each leaderboard row
  function renderEntry({ item, index }: { item: LeaderboardEntry; index: number }) {
    const isMe       = item.userId === myId;
    const isExpanded = expandedId === item.userId;
    const isLoadingU = loadingUser === item.userId;
    const preds      = upData.current[item.userId] ?? [];

    return (
      <View style={[e.wrapper, isMe && e.wrapperMe]}>
        <View style={e.row}>
          <RankLabel rank={index + 1} />
          <Avatar name={item.name} />
          <View style={e.nameBlock}>
            <Text style={e.name} numberOfLines={1}>
              {item.name}{isMe ? ' (you)' : ''}
            </Text>
            <Text style={e.sub}>{item.predictionsCount} picks · {item.accuracy}% scored</Text>
          </View>
          <View style={[e.ptsBadge, isMe && e.ptsBadgeMe]}>
            <Text style={[e.ptsText, isMe && e.ptsTextMe]}>{item.totalPoints} pts</Text>
          </View>
          <TouchableOpacity style={e.chevron} onPress={() => toggleUser(item.userId)}>
            <Text style={e.chevronIcon}>{isExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>
        {isExpanded && (
          isLoadingU
            ? <ActivityIndicator size="small" color={Colors.primary} style={{ padding: 8 }} />
            : <UserPredictionPanel preds={preds} />
        )}
      </View>
    );
  }

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'all',   label: 'All Time' },
    { key: 'month', label: 'Month'    },
    { key: 'week',  label: 'Week'     },
  ];

  return (
    <View style={s.screen}>
      <FlatList
        data={loading ? [] : leaderboard}
        keyExtractor={(item) => item.userId}
        renderItem={renderEntry}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={s.header}>
            {/* Group selector */}
            {groups.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupScroll}>
                <View style={s.groupRow}>
                  {groups.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={[s.groupBtn, groupId === g.id && s.groupBtnActive]}
                      onPress={() => setGroupId(g.id)}
                    >
                      <Text style={[s.groupText, groupId === g.id && s.groupTextActive]}>
                        {g.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Period tabs */}
            <View style={s.periodRow}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[s.periodBtn, period === p.key && s.periodBtnActive]}
                  onPress={() => setPeriod(p.key)}
                >
                  <Text style={[s.periodText, period === p.key && s.periodTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Week navigation */}
            {period === 'week' && (
              <View style={s.navRow}>
                <TouchableOpacity style={s.navBtn} onPress={() => setWeekOffset((o) => o - 1)}>
                  <Text style={s.navIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={s.navLabel}>{weekLabel()}</Text>
                <TouchableOpacity style={s.navBtn} onPress={() => setWeekOffset((o) => o + 1)}>
                  <Text style={s.navIcon}>›</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Month navigation */}
            {period === 'month' && (
              <View style={s.navRow}>
                <TouchableOpacity style={s.navBtn} onPress={() => setMonthOffset((o) => o - 1)}>
                  <Text style={s.navIcon}>‹</Text>
                </TouchableOpacity>
                <Text style={s.navLabel}>{monthLabel()}</Text>
                <TouchableOpacity style={s.navBtn} onPress={() => setMonthOffset((o) => o + 1)}>
                  <Text style={s.navIcon}>›</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading
            ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            : <Text style={s.emptyText}>No predictions yet in this period.</Text>
        }
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  list:   { padding: 12, gap: 8 },

  header: { gap: 10, marginBottom: 4 },
  groupScroll: { marginBottom: 0 },
  groupRow:    { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  groupBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
  },
  groupBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  groupText:      { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  groupTextActive: { color: Colors.bg },

  periodRow: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 10, padding: 3 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  periodBtnActive: { backgroundColor: Colors.bg },
  periodText:      { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  periodTextActive: { color: Colors.text },

  navRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn:  { padding: 8 },
  navIcon: { fontSize: 22, color: Colors.text, fontWeight: '600' },
  navLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },

  emptyText: { textAlign: 'center', color: Colors.textMuted, fontSize: 14, paddingTop: 24 },
});

const e = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
  },
  wrapperMe: { borderColor: 'rgba(74,222,128,0.35)', backgroundColor: 'rgba(74,222,128,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  nameBlock: { flex: 1, gap: 1 },
  name:      { fontSize: 14, fontWeight: '600', color: Colors.text },
  sub:       { fontSize: 11, color: Colors.textMuted },

  ptsBadge:    { borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  ptsBadgeMe:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  ptsText:     { fontSize: 12, fontWeight: '700', color: Colors.text },
  ptsTextMe:   { color: Colors.bg },

  chevron:     { padding: 4 },
  chevronIcon: { fontSize: 12, color: Colors.textMuted },
});
