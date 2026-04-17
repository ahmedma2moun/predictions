import { useCallback, useMemo, useState } from 'react';
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
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

type TabKey = 'future' | 'past';
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
    futurePreds,
    pastPreds,
    totalPoints,
  } = usePredictions();

  const [tab, setTab]               = useState<TabKey>('past');
  const [pastVisible, setPastVisible] = useState(PAGE_SIZE);

  const renderItem = useCallback(
    ({ item }: { item: (typeof futurePreds)[number] }) => <PredictionCard pred={item} />,
    [],
  );

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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
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
      renderItem={renderItem}
    />
  );
}

function TabButton({
  label, count, active, onPress,
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
        {count > 0 && <Text style={styles.tabCount}> ({count})</Text>}
      </Text>
    </Pressable>
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
    tabs: {
      flexDirection: 'row',
      backgroundColor: c.cardElevated,
      borderRadius: radius.md,
      padding: 4,
      gap: 4,
    },
    tabBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
    tabBtnActive: { backgroundColor: c.card },
    tabText: { color: c.mutedForeground, fontSize: font.size.sm, fontWeight: font.weight.medium },
    tabTextActive: { color: c.foreground, fontWeight: font.weight.semibold },
    tabCount: { color: c.mutedForeground, fontWeight: font.weight.regular, fontSize: font.size.xs },
    showMore: { alignItems: 'center', paddingVertical: spacing.md },
    showMoreText: { color: c.mutedForeground, fontSize: font.size.sm },
  });
}
