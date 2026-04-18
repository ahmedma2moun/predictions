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
import { Badge, Muted } from '@/components/ui';
import { PredictionCard } from '@/components/PredictionCard';
import { usePredictions } from '@/hooks/usePredictions';
import { usePeriodFilter } from '@/hooks/usePeriodFilter';
import { PeriodFilterBar } from '@/components/PeriodFilterBar';
import { font, spacing, type Palette } from '@/theme/colors';
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

  const {
    period, setPeriod,
    weekOffset, setWeekOffset,
    monthOffset, setMonthOffset,
    weekLabel, monthLabel,
    dateRange,
  } = usePeriodFilter();

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [dateRange]);

  const filtered = useMemo(() => {
    if (!dateRange) return predictions;
    const { from, to } = dateRange;
    return predictions.filter(p => {
      const t = new Date(p.match.kickoffTime).getTime();
      return t >= from.getTime() && t < to.getTime();
    });
  }, [predictions, dateRange]);

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
          <PeriodFilterBar
            period={period}
            setPeriod={setPeriod}
            weekLabel={weekLabel}
            monthLabel={monthLabel}
            setWeekOffset={setWeekOffset}
            setMonthOffset={setMonthOffset}
          />
        </View>
      }
      ListEmptyComponent={
        <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
          {error
            ? error
            : predictions.length === 0
            ? 'No predictions yet. Go predict some matches!'
            : 'No predictions for this period.'}
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
  });
}
