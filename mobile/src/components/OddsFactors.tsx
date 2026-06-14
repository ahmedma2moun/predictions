import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { MatchOddsFactors } from '@/types/api';

export type PredictedOutcome = 'homeWin' | 'draw' | 'awayWin';

export function getPredictedOutcome(homeScore: number, awayScore: number): PredictedOutcome {
  if (homeScore > awayScore) return 'homeWin';
  if (awayScore > homeScore) return 'awayWin';
  return 'draw';
}

const BASE_KEYS: Array<{ key: PredictedOutcome; label: string }> = [
  { key: 'homeWin', label: '1' },
  { key: 'draw',    label: 'X' },
  { key: 'awayWin', label: '2' },
];

/**
 * Compact 1/X/2 odds factors shown inline.
 * `picked` highlights the outcome the user predicted.
 */
export function OddsFactors({
  odds,
  picked,
  style,
}: {
  odds: MatchOddsFactors;
  picked?: PredictedOutcome;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}>
      {BASE_KEYS.map(({ key, label }) => (
        <Text
          key={key}
          style={{
            color: picked === key ? colors.warning : colors.mutedForeground,
            fontSize: font.size.xs,
            fontWeight: picked === key ? font.weight.semibold : font.weight.regular,
            fontFamily: 'JetBrainsMono',
            fontVariant: ['tabular-nums'],
          }}
        >
          {label} {odds[key].toFixed(2)}
        </Text>
      ))}
    </View>
  );
}

/** Icon button that opens a modal showing all 3 odds with the applied outcome highlighted. */
export function OddsPopover({
  odds,
  picked,
  homeTeamName,
  awayTeamName,
  style,
}: {
  odds: MatchOddsFactors;
  picked?: PredictedOutcome;
  homeTeamName?: string;
  awayTeamName?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const cells = [
    { key: 'homeWin' as PredictedOutcome, label: homeTeamName ? `${homeTeamName} won` : 'Home won' },
    { key: 'draw'    as PredictedOutcome, label: 'Draw' },
    { key: 'awayWin' as PredictedOutcome, label: awayTeamName ? `${awayTeamName} won` : 'Away won' },
  ];

  return (
    <>
      <Pressable
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.6 }, style as any]}
        accessibilityLabel="View match odds"
      >
        <Ionicons name="bar-chart-outline" size={13} color={colors.mutedForeground} />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.popover} onPress={e => e.stopPropagation()}>
            <Text style={styles.title}>Match odds</Text>
            <View style={{ gap: 4 }}>
              {cells.map(({ key, label }) => {
                const isPicked = picked === key;
                return (
                  <View
                    key={key}
                    style={[
                      styles.row,
                      isPicked && { backgroundColor: colors.warning + '26', borderRadius: radius.sm },
                    ]}
                  >
                    <Text style={[styles.label, isPicked && { color: colors.warning, fontWeight: font.weight.semibold }]}>
                      {label}
                    </Text>
                    <Text style={[styles.value, isPicked && { color: colors.warning, fontWeight: font.weight.semibold }]}>
                      {odds[key].toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    trigger: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    popover: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minWidth: 200,
      maxWidth: 300,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    title: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xl,
      paddingVertical: 3,
      paddingHorizontal: spacing.xs,
    },
    label: {
      flex: 1,
      color: c.foreground,
      fontSize: font.size.xs,
      fontWeight: font.weight.medium,
    },
    value: {
      color: c.mutedForeground,
      fontSize: font.size.xs,
      fontFamily: 'JetBrainsMono',
      fontVariant: ['tabular-nums'],
    },
  });
}
