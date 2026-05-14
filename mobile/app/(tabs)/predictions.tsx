import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Muted } from '@/components/ui';
import { PredictionCard } from '@/components/PredictionCard';
import { AccuracyStatsCard } from '@/components/AccuracyStatsCard';
import { AppHeader } from '@/components/AppHeader';
import { usePredictions } from '@/hooks/usePredictions';
import { useAccuracyStats } from '@/hooks/useAccuracyStats';
import { computeWeekLabel, getWeekBounds } from '@/utils/leaderboard-dates';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

const PAGE_SIZE = 20;

export default function PredictionsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const {
    predictions,
    loading,
    refreshing,
    error,
    onRefresh,
    totalPoints,
  } = usePredictions();

  const { data: accuracyStats, refresh: refreshStats } = useAccuracyStats();

  const handleRefresh = useCallback(() => {
    onRefresh();
    refreshStats();
  }, [onRefresh, refreshStats]);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekLabel = useMemo(() => computeWeekLabel(weekOffset), [weekOffset]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [weekOffset]);

  const filtered = useMemo(() => {
    const { from, to } = getWeekBounds(weekOffset);
    return predictions.filter(p => {
      if (!p.match.result) return false;
      const t = new Date(p.match.kickoffTime).getTime();
      return t >= from.getTime() && t < to.getTime();
    });
  }, [predictions, weekOffset]);

  const sorted = useMemo(
    () => [...filtered].sort(
      (a, b) => new Date(b.match.kickoffTime).getTime() - new Date(a.match.kickoffTime).getTime(),
    ),
    [filtered],
  );

  const weekPoints = useMemo(
    () => filtered.reduce((sum, p) => sum + (p.pointsAwarded ?? 0), 0),
    [filtered],
  );

  // Last 10 scored predictions across all time for sparkline
  const recentPoints = useMemo(() => {
    return [...predictions]
      .filter(p => p.match.result != null)
      .sort((a, b) => new Date(b.match.kickoffTime).getTime() - new Date(a.match.kickoffTime).getTime())
      .slice(0, 10)
      .reverse()
      .map(p => p.pointsAwarded ?? 0);
  }, [predictions]);

  const page    = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  const renderItem = useCallback(
    ({ item }: { item: (typeof sorted)[number] }) => <PredictionCard pred={item} />,
    [],
  );

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="My Score" subtitle={`${totalPoints} pts total`} />
      <FlatList
        data={page}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        style={{ backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {accuracyStats && accuracyStats.totalFinished > 0 && (
              <AccuracyStatsCard
                stats={accuracyStats}
                weekPoints={weekPoints}
                recentPoints={recentPoints}
              />
            )}
            <WeekNav
              label={weekLabel}
              onPrev={() => setWeekOffset(o => o - 1)}
              onNext={() => setWeekOffset(o => o + 1)}
            />
          </View>
        }
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
            {error
              ? error
              : predictions.length === 0
              ? 'No predictions yet. Go predict some matches!'
              : 'No scored predictions for this week.'}
          </Muted>
        }
        ListFooterComponent={
          hasMore ? (
            <Pressable
              onPress={() => setVisibleCount(n => n + PAGE_SIZE)}
              style={({ pressed }) => [styles.showMore, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.showMoreText, { color: colors.mutedForeground }]}>
                Show more ({sorted.length - visibleCount} remaining)
              </Text>
            </Pressable>
          ) : null
        }
        renderItem={renderItem}
      />
    </View>
  );
}

function WeekNav({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles2.weekNav}>
      <Pressable
        onPress={onPrev}
        hitSlop={12}
        style={({ pressed }) => [
          styles2.navBtn,
          { backgroundColor: colors.cardElevated, borderColor: colors.border },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={colors.foreground} />
      </Pressable>
      <Text style={[styles2.weekLabel, { color: colors.foreground }]}>{label}</Text>
      <Pressable
        onPress={onNext}
        hitSlop={12}
        style={({ pressed }) => [
          styles2.navBtn,
          { backgroundColor: colors.cardElevated, borderColor: colors.border },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

const styles2 = StyleSheet.create({
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
});

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    list: { padding: spacing.lg, gap: spacing.md },
    listHeader: { gap: spacing.md, marginBottom: spacing.sm },
    showMore: { alignItems: 'center', paddingVertical: spacing.md },
    showMoreText: { fontSize: font.size.sm },
  });
}
