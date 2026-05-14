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

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week',  label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all',   label: 'All Time' },
];

export function PeriodFilterBar({
  period, setPeriod,
  weekLabel, monthLabel,
  setWeekOffset, setMonthOffset,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Segmented control shell */}
      <View style={[styles.segShell, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
        {PERIODS.map(p => {
          const active = period === p.value;
          return (
            <Pressable
              key={p.value}
              onPress={() => setPeriod(p.value)}
              style={({ pressed }) => [
                styles.segBtn,
                active && [styles.segBtnActive, { backgroundColor: colors.primary }],
                pressed && !active && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.segText,
                  { color: active ? colors.primaryForeground : colors.mutedForeground },
                  active && styles.segTextActive,
                ]}
              >
                {p.label}
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
      <Pressable
        onPress={onPrev}
        hitSlop={12}
        style={({ pressed }) => [
          styles.navBtn,
          { backgroundColor: colors.cardElevated, borderColor: colors.border },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="chevron-back" size={16} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.navLabel, { color: colors.foreground }]}>{label}</Text>
      <Pressable
        onPress={onNext}
        hitSlop={12}
        style={({ pressed }) => [
          styles.navBtn,
          { backgroundColor: colors.cardElevated, borderColor: colors.border },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="chevron-forward" size={16} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    segShell: {
      flexDirection: 'row',
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 4,
      gap: 4,
    },
    segBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    segBtnActive: { borderRadius: radius.sm },
    segText: { fontSize: font.size.sm, fontWeight: font.weight.medium },
    segTextActive: { fontWeight: font.weight.semibold },
    nav: {
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
    navLabel: {
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      fontVariant: ['tabular-nums'],
    },
  });
}
