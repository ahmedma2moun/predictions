import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Card, Muted, SectionTitle } from '@/components/ui';
import { useRemoteData } from '@/hooks/useRemoteData';
import { font, radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { GroupPredictionEntry, LeaderboardGroup, LiveGroupStanding, LiveStandingEntry } from '@/types/api';

const styles = StyleSheet.create({
  groupHeader: { gap: spacing.xs },
  groupTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  groupTabText: { fontSize: font.size.xs, fontWeight: font.weight.medium },
  predRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  predName: { fontSize: font.size.sm, fontWeight: font.weight.medium },
  predScore: { fontSize: font.size.sm, fontVariant: ['tabular-nums'] },
});

interface Props {
  matchId: string;
  isAdmin: boolean;
  locked: boolean;
  hasResult: boolean;
  isKnockout: boolean;
  liveScore: { homeScore: number; awayScore: number } | null;
}

/** Per-group live standing + this match's predictions, compared side by side. Mirrors the web app's GroupPredictions.tsx. */
export function GroupComparisonCard({ matchId, isAdmin, locked, hasResult, isKnockout, liveScore }: Props) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const visible = locked || isAdmin;

  const loadGroups = useCallback(
    (signal: AbortSignal) => apiRequest<LeaderboardGroup[]>('/api/mobile/groups', { token: token!, signal }),
    [token],
  );
  const { data: rawGroups } = useRemoteData(loadGroups, [token], { enabled: !!token && visible });
  const groups = useMemo(() => {
    return [...(rawGroups ?? [])].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [rawGroups]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  const loadComparison = useCallback(
    async (signal: AbortSignal) => {
      const params = new URLSearchParams({ groupId: selectedGroupId! });
      if (!hasResult && liveScore) {
        params.set('liveHomeScore', String(liveScore.homeScore));
        params.set('liveAwayScore', String(liveScore.awayScore));
      }
      const [predictions, standing] = await Promise.all([
        apiRequest<GroupPredictionEntry[]>(
          `/api/mobile/matches/${matchId}/group-predictions?${params.toString()}`,
          { token: token!, signal },
        ).catch(() => null),
        apiRequest<LiveGroupStanding>(
          `/api/mobile/leaderboard/live?groupId=${encodeURIComponent(selectedGroupId!)}`,
          { token: token!, signal },
        ).catch(() => null),
      ]);
      return { predictions, standing };
    },
    [token, matchId, selectedGroupId, hasResult, liveScore],
  );
  const { data, loading } = useRemoteData(loadComparison, [token, matchId, selectedGroupId, hasResult, liveScore], {
    enabled: !!token && !!selectedGroupId && visible,
  });

  if (!visible || groups.length === 0) return null;

  const predictions = data?.predictions ?? null;
  const standing = data?.standing ?? null;
  const predicted = predictions?.filter(p => p.predicted) ?? [];

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.groupHeader}>
        <SectionTitle>Group Comparison</SectionTitle>
        {groups.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {groups.map(g => (
              <Pressable
                key={g.id}
                onPress={() => setSelectedGroupId(g.id)}
                style={[
                  styles.groupTab,
                  { borderColor: colors.border },
                  selectedGroupId === g.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.groupTabText,
                    { color: colors.mutedForeground },
                    selectedGroupId === g.id && { color: colors.primaryForeground },
                  ]}
                >
                  {g.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
      ) : predicted.length === 0 ? (
        <Muted style={{ textAlign: 'center', paddingVertical: spacing.md }}>No predictions in this group.</Muted>
      ) : (
        <View>
          {sortByStanding(predicted, standing).map((p, i) => {
            const s = standingFor(standing, p.userId);
            return (
              <View
                key={p.userId}
                style={[styles.predRow, { borderTopColor: colors.border }, i === 0 && { borderTopWidth: 0 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  {s && (
                    <>
                      <Text style={{ width: 24, color: colors.mutedForeground, fontSize: font.size.xs, fontWeight: font.weight.bold, fontFamily: 'JetBrainsMono' }}>
                        #{s.rank}
                      </Text>
                      <View style={{ width: 26, alignItems: 'center' }}>
                        <StandingMovement entry={s} />
                      </View>
                    </>
                  )}
                  <Text style={[styles.predName, { color: colors.foreground, flexShrink: 1 }]} numberOfLines={1}>
                    {p.userName ?? 'Unknown'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[styles.predScore, { color: colors.foreground, fontFamily: 'JetBrainsMono' }]}>
                    {p.homeScore} – {p.awayScore}
                  </Text>
                  {p.isLive && (
                    <Text style={{ color: colors.live, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>
                      {(p.pointsAwarded ?? 0) > 0 ? `+${p.pointsAwarded} live` : '0 live'}
                    </Text>
                  )}
                  {!isKnockout && !p.isLive && hasResult && (
                    <Text style={{ color: (p.pointsAwarded ?? 0) > 0 ? colors.warning : colors.mutedForeground, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>
                      {(p.pointsAwarded ?? 0) > 0 ? `+${p.pointsAwarded}` : '0'}
                    </Text>
                  )}
                  {s && (
                    <Text style={{ color: colors.foreground, fontSize: font.size.sm, fontWeight: font.weight.bold, fontFamily: 'JetBrainsMono' }}>
                      {s.liveTotalPoints} pts
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function StandingMovement({ entry }: { entry: LiveStandingEntry }) {
  const { colors } = useTheme();
  if (entry.movement === 'up') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="arrow-up" size={13} color={colors.success} />
        <Text style={{ color: colors.success, fontSize: 10, fontWeight: '700', fontFamily: 'JetBrainsMono' }}>
          {entry.previousRank - entry.rank}
        </Text>
      </View>
    );
  }
  if (entry.movement === 'down') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="arrow-down" size={13} color={colors.destructive} />
        <Text style={{ color: colors.destructive, fontSize: 10, fontWeight: '700', fontFamily: 'JetBrainsMono' }}>
          {entry.rank - entry.previousRank}
        </Text>
      </View>
    );
  }
  return <Ionicons name="remove" size={13} color={colors.mutedForeground} />;
}

function standingFor(standing: LiveGroupStanding | null, userId: string): LiveStandingEntry | undefined {
  return standing?.standings.find(s => s.userId === userId);
}

function sortByStanding(entries: GroupPredictionEntry[], standing: LiveGroupStanding | null): GroupPredictionEntry[] {
  if (!standing) return entries;
  return [...entries].sort((a, b) => {
    const ra = standingFor(standing, a.userId)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rb = standingFor(standing, b.userId)?.rank ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}
