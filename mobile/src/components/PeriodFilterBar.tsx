import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { Period } from '@/hooks/usePeriodFilter';

interface Props {
  period: Period;
  setPeriod: (p: Period) => void;
  weekLabel: string;
  monthLabel: string;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  setMonthOffset: React.Dispatch<React.SetStateAction<number>>;
}

export function PeriodFilterBar({
  period, setPeriod,
  weekLabel, monthLabel,
  setWeekOffset, setMonthOffset,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={{ gap: spacing.sm }}>
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
        <OffsetNav
          label={weekLabel}
          onPrev={() => setWeekOffset(o => o - 1)}
          onNext={() => setWeekOffset(o => o + 1)}
        />
      )}
      {period === 'month' && (
        <OffsetNav
          label={monthLabel}
          onPrev={() => setMonthOffset(o => o - 1)}
          onNext={() => setMonthOffset(o => o + 1)}
        />
      )}
    </View>
  );
}

function OffsetNav({
  label, onPrev, onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.nav}>
      <Pressable onPress={onPrev} hitSlop={12} style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}>
        <Ionicons name="chevron-back" size={18} color={colors.foreground} />
      </Pressable>
      <Text style={styles.navLabel}>{label}</Text>
      <Pressable onPress={onNext} hitSlop={12} style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.6 }]}>
        <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
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
    segText: { color: c.mutedForeground, fontSize: font.size.sm, fontWeight: font.weight.medium },
    segTextActive: { color: c.foreground, fontWeight: font.weight.semibold },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
    },
    navBtn: { padding: 6, borderRadius: radius.sm },
    navLabel: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      fontVariant: ['tabular-nums'],
    },
  });
}
