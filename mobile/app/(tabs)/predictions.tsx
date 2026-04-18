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
import { Badge, Muted } from '@/components/ui';
import { PredictionCard } from '@/components/PredictionCard';
import { usePredictions } from '@/hooks/usePredictions';
import { computeWeekLabel, getWeekBounds } from '@/utils/leaderboard-dates';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

const PAGE_SIZE = 20;

export default function PredictionsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const {
    predictions,
    loading,
    refreshing,
    error,
    onRefresh,
    totalPoints,
  } = usePredictions();

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

  const page    = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  const renderItem = useCallback(
    ({ item }: { item: (typeof sorted)[number] }) => <PredictionCard pred={item} />,
    [],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={page}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.heading}>My Score</Text>
            <Badge variant="outline">{totalPoints} pts total</Badge>
          </View>
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
            : 'Score processed for this period.'}
        </Muted>
      }
      ListFooterComponent={
        hasMore ? (
          <Pressable
            onPress={() => setVisibleCount(n => n + PAGE_SIZE)}
            style={({ pressed }) => [styles.showMore, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.showMoreText}>
              Show more ({sorted.length - visibleCount} remaining)
            </Text>
          </Pressable>
        ) : null
      }
      renderItem={renderItem}
    />
  );
}

function WeekNav({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.weekNav}>
      <Pressable onPress={onPrev} hitSlop={12} style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}>
        <Ionicons name="chevron-back" size={18} color={colors.foreground} />
      </Pressable>
      <Text style={styles.weekLabel}>{label}</Text>
      <Pressable onPress={onNext} hitSlop={12} style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}>
        <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
      </Pressable>
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
    list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    header: { marginBottom: spacing.sm, gap: spacing.md },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heading: { color: c.foreground, fontSize: font.size.xl, fontWeight: font.weight.bold },
    showMore: { alignItems: 'center', paddingVertical: spacing.md },
    showMoreText: { color: c.mutedForeground, fontSize: font.size.sm },
    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
    },
    navBtn: { padding: 6, borderRadius: radius.sm },
    weekLabel: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      fontVariant: ['tabular-nums'],
    },
  });
}
