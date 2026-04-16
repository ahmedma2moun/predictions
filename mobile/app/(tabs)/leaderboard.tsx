import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Card, Muted } from '@/components/ui';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type {
  LeaderboardEntry,
  LeaderboardGroup,
  LeaderboardLeague,
  LeaderboardUserPrediction,
} from '@/types/api';
import { formatKickoff } from '@/utils/format';

type Period = 'all' | 'month' | 'week';

// ── Date helpers ─────────────────────────────────────────────────────────────
// Week = Friday 00:00 → next Friday 00:00 local. (Matches web /leaderboard.)
function getWeekBounds(offset: number) {
  const now = new Date();
  const daysSinceFriday = (now.getDay() - 5 + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() - daysSinceFriday + offset * 7);
  friday.setHours(0, 0, 0, 0);
  const next = new Date(friday);
  next.setDate(friday.getDate() + 7);
  return { from: friday, to: next };
}

function getMonthBounds(offset: number) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from, to };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function fmtMonthYear(d: Date) {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function LeaderboardScreen() {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [period, setPeriod]           = useState<Period>('all');
  const [weekOffset, setWeekOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [groups, setGroups]       = useState<LeaderboardGroup[]>([]);
  const [groupId, setGroupId]     = useState<string | null>(null);
  const [groupsReady, setGroupsReady] = useState(false);

  const [leagues, setLeagues]           = useState<LeaderboardLeague[]>([]);
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);

  const [entries, setEntries]     = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const expandedCache = useRef<Record<string, LeaderboardUserPrediction[]>>({});
  const [expandedData, setExpandedData] = useState<LeaderboardUserPrediction[] | null>(null);

  // Range derivation
  const range = useMemo<{ from: Date; to: Date } | null>(() => {
    if (period === 'week')  return getWeekBounds(weekOffset);
    if (period === 'month') return getMonthBounds(monthOffset);
    return null;
  }, [period, weekOffset, monthOffset]);

  // Fetch groups once
  useEffect(() => {
    if (!token) return;
    apiRequest<LeaderboardGroup[]>('/api/mobile/groups', { token })
      .then(data => {
        const sorted = [...data.filter(g => !g.isDefault), ...data.filter(g => g.isDefault)];
        setGroups(sorted);
        if (sorted.length > 0) setGroupId(sorted[0].id);
      })
      .catch(() => {})
      .finally(() => setGroupsReady(true));
  }, [token]);

  // Fetch leagues once
  useEffect(() => {
    if (!token) return;
    apiRequest<LeaderboardLeague[]>('/api/mobile/leagues', { token })
      .then(setLeagues)
      .catch(() => {});
  }, [token]);

  // Reset expansion whenever filters change
  useEffect(() => {
    setExpandedUserId(null);
    setExpandedData(null);
  }, [period, weekOffset, monthOffset, groupId, selectedLeagues]);

  // Fetch leaderboard
  const fetchBoard = useCallback(async () => {
    if (!token || !groupsReady) return;
    let url = '/api/mobile/leaderboard?_=1';
    if (range) {
      url += `&from=${encodeURIComponent(range.from.toISOString())}`;
      url += `&to=${encodeURIComponent(range.to.toISOString())}`;
    }
    if (groupId) url += `&groupId=${encodeURIComponent(groupId)}`;
    for (const lid of selectedLeagues) url += `&leagueId=${encodeURIComponent(lid)}`;

    try {
      const data = await apiRequest<LeaderboardEntry[]>(url, { token });
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, groupsReady, range, groupId, selectedLeagues]);

  useEffect(() => {
    setLoading(true);
    fetchBoard();
  }, [fetchBoard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBoard();
  }, [fetchBoard]);

  // Expand handler
  const toggleExpand = useCallback(async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setExpandedData(null);
      return;
    }
    if (!token) return;

    const key = [
      userId,
      range?.from.toISOString() ?? '',
      range?.to.toISOString() ?? '',
      selectedLeagues.slice().sort().join(','),
    ].join(':');

    setExpandedUserId(userId);
    if (expandedCache.current[key]) {
      setExpandedData(expandedCache.current[key]);
      return;
    }
    setExpandedLoading(true);
    setExpandedData(null);

    let url = `/api/mobile/leaderboard/user-predictions?userId=${encodeURIComponent(userId)}`;
    if (range) {
      url += `&from=${encodeURIComponent(range.from.toISOString())}`;
      url += `&to=${encodeURIComponent(range.to.toISOString())}`;
    }
    for (const lid of selectedLeagues) url += `&leagueId=${encodeURIComponent(lid)}`;

    try {
      const data = await apiRequest<LeaderboardUserPrediction[]>(url, { token });
      expandedCache.current[key] = data;
      setExpandedData(data);
    } catch {
      setExpandedData([]);
    } finally {
      setExpandedLoading(false);
    }
  }, [expandedUserId, token, range, selectedLeagues]);

  const myId = user?.id;

  const weekLabel = useMemo(() => {
    const { from, to } = getWeekBounds(weekOffset);
    const thursdayEnd = new Date(to);
    thursdayEnd.setDate(to.getDate() - 1);
    return `${fmtDate(from)} – ${fmtDate(thursdayEnd)}`;
  }, [weekOffset]);

  const monthLabel = useMemo(() => fmtMonthYear(getMonthBounds(monthOffset).from), [monthOffset]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={e => e.userId}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing.md }}>
          <Text style={styles.heading}>Leaderboard</Text>

          {groups.length > 1 && (
            <View style={styles.chipRow}>
              {groups.map(g => {
                const active = g.id === groupId;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => setGroupId(g.id)}
                    style={({ pressed }) => [
                      styles.chip,
                      active ? styles.chipActive : styles.chipInactive,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text style={active ? styles.chipTextActive : styles.chipText}>{g.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {leagues.length > 0 && (
            <LeagueMultiSelect
              leagues={leagues}
              selected={selectedLeagues}
              setSelected={setSelectedLeagues}
              open={leagueDropdownOpen}
              setOpen={setLeagueDropdownOpen}
            />
          )}

          <View style={styles.segmented}>
            {(['all', 'month', 'week'] as Period[]).map(p => {
              const active = period === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={({ pressed }) => [
                    styles.segBtn,
                    active && styles.segBtnActive,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.segText, active && styles.segTextActive]}>
                    {p === 'all' ? 'All Time' : p === 'month' ? 'Month' : 'Week'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {period === 'week' && (
            <PeriodNav
              label={weekLabel}
              onPrev={() => setWeekOffset(o => o - 1)}
              onNext={() => setWeekOffset(o => o + 1)}
            />
          )}
          {period === 'month' && (
            <PeriodNav
              label={monthLabel}
              onPrev={() => setMonthOffset(o => o - 1)}
              onNext={() => setMonthOffset(o => o + 1)}
            />
          )}
        </View>
      }
      ListEmptyComponent={
        <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
          No predictions yet
        </Muted>
      }
      renderItem={({ item, index }) => {
        const isMe = myId === item.userId;
        const isExpanded = expandedUserId === item.userId;
        return (
          <Card
            style={[
              styles.rowCard,
              isMe && { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftBorder },
            ]}
          >
            <Pressable
              onPress={() => toggleExpand(item.userId)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <Text style={[
                styles.rank,
                index < 3 ? { color: colors.gold } : { color: colors.mutedForeground },
              ]}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
              </Text>
              <Avatar name={item.name} url={item.avatarUrl} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}{isMe ? ' (you)' : ''}
                </Text>
                <Muted style={{ fontSize: font.size.xs }}>{item.predictionsCount} picks</Muted>
              </View>
              <Badge variant={isMe ? 'default' : 'outline'}>
                {item.totalPoints} pts
              </Badge>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.mutedForeground}
                style={{ marginLeft: 4 }}
              />
            </Pressable>

            {isExpanded && (
              <View style={styles.expandedBox}>
                {expandedLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : expandedData && expandedData.length > 0 ? (
                  expandedData.map(p => <UserPredRow key={p.matchId} p={p} />)
                ) : (
                  <Muted style={{ textAlign: 'center', fontSize: font.size.xs }}>
                    No scored predictions in this period.
                  </Muted>
                )}
              </View>
            )}
          </Card>
        );
      }}
    />
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PeriodNav({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.periodNav}>
      <Pressable
        onPress={onPrev}
        hitSlop={12}
        style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={18} color={colors.foreground} />
      </Pressable>
      <Text style={styles.periodLabel}>{label}</Text>
      <Pressable
        onPress={onNext}
        hitSlop={12}
        style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

function LeagueMultiSelect({
  leagues,
  selected,
  setSelected,
  open,
  setOpen,
}: {
  leagues: LeaderboardLeague[];
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const label = useMemo(() => {
    if (selected.length === 0) return 'All Tournaments';
    if (selected.length === 1) {
      const l = leagues.find(x => x.externalId.toString() === selected[0]);
      return l?.name ?? '1 selected';
    }
    return `${selected.length} tournaments`;
  }, [selected, leagues]);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={({ pressed }) => [
          styles.dropdown,
          open && { borderColor: colors.primary },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.dropdownText} numberOfLines={1}>{label}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>

      {open && (
        <Card style={styles.dropdownPanel}>
          <CheckboxRow
            label="All Tournaments"
            checked={selected.length === 0}
            onPress={() => setSelected([])}
            bold={selected.length === 0}
          />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
          {leagues.map(l => {
            const val = l.externalId.toString();
            const checked = selected.includes(val);
            return (
              <CheckboxRow
                key={l.id}
                label={l.name}
                checked={checked}
                onPress={() =>
                  setSelected(prev => (checked ? prev.filter(x => x !== val) : [...prev, val]))
                }
              />
            );
          })}
        </Card>
      )}
    </View>
  );
}

function CheckboxRow({
  label,
  checked,
  onPress,
  bold,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  bold?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.checkboxRow, pressed && { backgroundColor: colors.accent }]}
    >
      <View
        style={[
          styles.checkbox,
          checked
            ? { backgroundColor: colors.primary, borderColor: colors.primary }
            : { borderColor: colors.border },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />}
      </View>
      <Text
        style={[
          styles.checkboxLabel,
          bold && { fontWeight: font.weight.semibold },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (url) {
    return <Image source={{ uri: url }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.foreground, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

function UserPredRow({ p }: { p: LeaderboardUserPrediction }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const awarded = p.pointsAwarded > 0;
  return (
    <View style={styles.predTile}>
      <View style={styles.predTileTop}>
        <Text style={styles.predTeams} numberOfLines={1}>
          {p.homeTeamName} <Text style={{ color: colors.mutedForeground, fontWeight: font.weight.regular }}>vs</Text> {p.awayTeamName}
        </Text>
        <Badge variant={awarded ? 'default' : 'secondary'}>
          +{p.pointsAwarded} pts
        </Badge>
      </View>
      <View style={styles.predTileMeta}>
        <Muted style={{ fontSize: font.size.xs }}>{formatKickoff(p.kickoffTime)}</Muted>
        <Text style={styles.metaText}>
          Pick: <Text style={styles.mono}>{p.homeScore}–{p.awayScore}</Text>
        </Text>
        <Text style={styles.metaText}>
          Result: <Text style={styles.mono}>{p.result.homeScore}–{p.result.awayScore}</Text>
        </Text>
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
    heading: {
      color: c.foreground,
      fontSize: font.size.xl,
      fontWeight: font.weight.bold,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    chipInactive: { backgroundColor: c.card, borderColor: c.border },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.mutedForeground, fontSize: font.size.sm, fontWeight: font.weight.medium },
    chipTextActive: { color: c.primaryForeground, fontSize: font.size.sm, fontWeight: font.weight.semibold },

    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    dropdownText: { color: c.foreground, fontSize: font.size.sm, flex: 1 },
    dropdownPanel: { marginTop: 6, padding: 0, overflow: 'hidden' },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    checkbox: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxLabel: { color: c.foreground, fontSize: font.size.sm },

    segmented: {
      flexDirection: 'row',
      backgroundColor: c.cardElevated,
      borderRadius: radius.md,
      padding: 4,
      gap: 4,
    },
    segBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    segBtnActive: { backgroundColor: c.card },
    segText: {
      color: c.mutedForeground,
      fontSize: font.size.sm,
      fontWeight: font.weight.medium,
    },
    segTextActive: { color: c.foreground, fontWeight: font.weight.semibold },

    periodNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
    },
    navBtn: {
      padding: 6,
      borderRadius: radius.sm,
    },
    periodLabel: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      fontVariant: ['tabular-nums'],
    },

    rowCard: {
      padding: 0,
      marginBottom: spacing.xs,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
    },
    rank: {
      width: 28,
      textAlign: 'center',
      fontSize: font.size.sm,
      fontWeight: font.weight.bold,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accent,
    },
    name: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
    },
    expandedBox: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      padding: spacing.md,
      gap: spacing.xs,
    },
    predTile: {
      backgroundColor: c.cardElevated,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      gap: 4,
    },
    predTileTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    predTeams: {
      flex: 1,
      color: c.foreground,
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
    },
    predTileMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    metaText: { color: c.mutedForeground, fontSize: font.size.xs },
    mono: { color: c.foreground, fontVariant: ['tabular-nums'] },
  });
}
