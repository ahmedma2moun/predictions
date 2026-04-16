import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import type { MatchDetail, PredictionHistoryItem } from '@/types/api';
import { formatKickoff, isMatchLocked } from '@/utils/format';

type TabKey = 'future' | 'past';
const PAGE_SIZE = 20;

export default function PredictionsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [predictions, setPredictions] = useState<PredictionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('past');
  const [pastVisible, setPastVisible] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await apiRequest<PredictionHistoryItem[]>(
        '/api/mobile/predictions',
        { token },
      );
      setPredictions(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load predictions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const { futurePreds, pastPreds, totalPoints } = useMemo(() => {
    const future: PredictionHistoryItem[] = [];
    const past: PredictionHistoryItem[] = [];
    let total = 0;
    for (const p of predictions) {
      total += p.pointsAwarded ?? 0;
      if (isMatchLocked(p.match.kickoffTime)) past.push(p);
      else future.push(p);
    }
    future.sort(
      (a, b) => new Date(a.match.kickoffTime).getTime() - new Date(b.match.kickoffTime).getTime(),
    );
    past.sort(
      (a, b) => new Date(b.match.kickoffTime).getTime() - new Date(a.match.kickoffTime).getTime(),
    );
    return { futurePreds: future, pastPreds: past, totalPoints: total };
  }, [predictions]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const visible = tab === 'future' ? futurePreds : pastPreds.slice(0, pastVisible);
  const hasMore = tab === 'past' && pastVisible < pastPreds.length;

  return (
    <FlatList
      data={visible}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.heading}>My Predictions</Text>
            <Badge variant="outline">{totalPoints} pts total</Badge>
          </View>
          {predictions.length > 0 && (
            <View style={styles.tabs}>
              <TabButton
                label="Upcoming"
                count={futurePreds.length}
                active={tab === 'future'}
                onPress={() => setTab('future')}
              />
              <TabButton
                label="Past"
                count={pastPreds.length}
                active={tab === 'past'}
                onPress={() => setTab('past')}
              />
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
          {error
            ? error
            : predictions.length === 0
            ? 'No predictions yet. Go predict some matches!'
            : tab === 'future'
            ? 'No upcoming predictions.'
            : 'No past predictions yet.'}
        </Muted>
      }
      ListFooterComponent={
        hasMore ? (
          <Pressable
            onPress={() => setPastVisible(n => n + PAGE_SIZE)}
            style={({ pressed }) => [styles.showMore, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.showMoreText}>
              Show more ({pastPreds.length - pastVisible} remaining)
            </Text>
          </Pressable>
        ) : null
      }
      renderItem={({ item }) => <PredictionCard pred={item} token={token} />}
    />
  );
}

function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabBtn,
        active && styles.tabBtnActive,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
        {count > 0 && (
          <Text style={styles.tabCount}> ({count})</Text>
        )}
      </Text>
    </Pressable>
  );
}

type OtherPrediction = NonNullable<MatchDetail['allPredictions']>[number];

function PredictionCard({ pred, token }: { pred: PredictionHistoryItem; token: string | null }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const match = pred.match;
  const isFinished = match.status === 'finished';
  const isLocked = match.status !== 'scheduled';

  const [open, setOpen] = useState(false);
  const [others, setOthers] = useState<OtherPrediction[] | null>(null);
  const [loadingOthers, setLoadingOthers] = useState(false);

  const toggle = useCallback(async () => {
    if (!open && others === null && token) {
      setLoadingOthers(true);
      try {
        const data = await apiRequest<MatchDetail>(
          `/api/mobile/matches/${match._id}`,
          { token },
        );
        setOthers(data.allPredictions ?? []);
      } catch {
        setOthers([]);
      } finally {
        setLoadingOthers(false);
      }
    }
    setOpen(v => !v);
  }, [open, others, token, match._id]);

  const awardedHighlight = isFinished && pred.pointsAwarded > 0;

  return (
    <Card
      style={[
        styles.predCard,
        awardedHighlight && { borderColor: colors.primarySoftBorder },
      ]}
    >
      <View style={styles.cardTop}>
        <Muted style={{ fontSize: font.size.xs }}>{formatKickoff(match.kickoffTime)}</Muted>
        <View style={styles.cardTopRight}>
          <Badge variant={isFinished ? 'secondary' : 'outline'}>
            {match.status.toUpperCase()}
          </Badge>
          {isFinished && (
            <Badge variant={pred.pointsAwarded > 0 ? 'default' : 'secondary'}>
              +{pred.pointsAwarded} pts
            </Badge>
          )}
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.sideCol}>
          <Muted style={styles.gridLabel}>Home</Muted>
          <Text style={styles.teamName} numberOfLines={2}>{match.homeTeam.name}</Text>
        </View>
        <View style={styles.pickCol}>
          <Muted style={styles.gridLabel}>Your pick</Muted>
          <Text style={styles.pickScore}>
            {pred.homeScore} – {pred.awayScore}
          </Text>
          {isFinished && match.result && (
            <Muted style={{ fontSize: font.size.xs, textAlign: 'center' }}>
              Result: {match.result.homeScore} – {match.result.awayScore}
              {match.result.penaltyHomeScore != null && (
                <> ({match.result.penaltyHomeScore} – {match.result.penaltyAwayScore} pen)</>
              )}
            </Muted>
          )}
        </View>
        <View style={styles.sideCol}>
          <Muted style={styles.gridLabel}>Away</Muted>
          <Text style={styles.teamName} numberOfLines={2}>{match.awayTeam.name}</Text>
        </View>
      </View>

      {isFinished && pred.scoringBreakdown && pred.scoringBreakdown.length > 0 && (
        <View style={styles.breakdown}>
          {pred.scoringBreakdown.map(rule => (
            <View
              key={rule.key}
              style={[
                styles.breakdownRow,
                !rule.awarded && { opacity: 0.45 },
              ]}
            >
              <Ionicons
                name={rule.awarded ? 'checkmark-circle' : 'close-circle-outline'}
                size={12}
                color={rule.awarded ? colors.success : colors.mutedForeground}
              />
              <Text style={styles.breakdownName} numberOfLines={1}>{rule.name}</Text>
              <Text
                style={[
                  styles.breakdownPoints,
                  { color: rule.awarded ? colors.success : colors.mutedForeground },
                ]}
              >
                {rule.awarded ? `+${rule.points}` : '0'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {isLocked && (
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [styles.toggleBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          {loadingOthers ? (
            <Text style={styles.toggleText}>Loading…</Text>
          ) : (
            <>
              <Text style={styles.toggleText}>
                {open ? 'Hide' : 'Show'} all predictions
              </Text>
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.mutedForeground}
              />
            </>
          )}
        </Pressable>
      )}

      {open && others && others.length > 0 && (
        <View style={styles.othersBox}>
          {others.map(o => (
            <View key={o.userId} style={styles.otherRow}>
              <Text style={styles.otherName} numberOfLines={1}>{o.userName}</Text>
              <View style={styles.otherRight}>
                <Text style={styles.otherScore}>
                  {o.homeScore} – {o.awayScore}
                </Text>
                {isFinished && (
                  <Text
                    style={[
                      styles.otherPts,
                      { color: (o.pointsAwarded ?? 0) > 0 ? colors.success : colors.mutedForeground },
                    ]}
                  >
                    +{o.pointsAwarded ?? 0} pts
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {open && others && others.length === 0 && (
        <Muted style={{ textAlign: 'center', marginTop: spacing.xs, fontSize: font.size.xs }}>
          No other predictions.
        </Muted>
      )}
    </Card>
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
    list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    header: { marginBottom: spacing.sm, gap: spacing.md },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heading: {
      color: c.foreground,
      fontSize: font.size.xl,
      fontWeight: font.weight.bold,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: c.cardElevated,
      borderRadius: radius.md,
      padding: 4,
      gap: 4,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    tabBtnActive: { backgroundColor: c.card },
    tabText: {
      color: c.mutedForeground,
      fontSize: font.size.sm,
      fontWeight: font.weight.medium,
    },
    tabTextActive: { color: c.foreground, fontWeight: font.weight.semibold },
    tabCount: {
      color: c.mutedForeground,
      fontWeight: font.weight.regular,
      fontSize: font.size.xs,
    },

    predCard: { gap: spacing.sm, paddingVertical: spacing.md },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

    grid: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sideCol: { flex: 1, alignItems: 'center', gap: 2 },
    pickCol: { flex: 1, alignItems: 'center', gap: 2 },
    gridLabel: { fontSize: font.size.xs },
    teamName: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.medium,
      textAlign: 'center',
    },
    pickScore: {
      color: c.foreground,
      fontSize: font.size.lg,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },

    breakdown: {
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      gap: 4,
    },
    breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    breakdownName: { flex: 1, color: c.foreground, fontSize: font.size.xs },
    breakdownPoints: {
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
      fontVariant: ['tabular-nums'],
    },

    toggleBtn: {
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    toggleText: {
      color: c.mutedForeground,
      fontSize: font.size.xs,
      fontWeight: font.weight.medium,
    },

    othersBox: { marginTop: spacing.xs, gap: 4 },
    otherRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: c.cardElevated,
      gap: spacing.sm,
    },
    otherName: {
      flex: 1,
      color: c.foreground,
      fontSize: font.size.xs,
      fontWeight: font.weight.medium,
    },
    otherRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    otherScore: {
      color: c.foreground,
      fontSize: font.size.xs,
      fontVariant: ['tabular-nums'],
    },
    otherPts: { fontSize: font.size.xs, fontWeight: font.weight.semibold },

    showMore: { alignItems: 'center', paddingVertical: spacing.md },
    showMoreText: { color: c.mutedForeground, fontSize: font.size.sm },
  });
}
