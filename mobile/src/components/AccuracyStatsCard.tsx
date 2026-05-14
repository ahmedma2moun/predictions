import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { AccuracyStats } from '@/types/api';

interface Props {
  stats: AccuracyStats;
  weekPoints?: number;
  recentPoints?: number[]; // last N scored prediction point values for sparkline
}

export const AccuracyStatsCard = memo(function AccuracyStatsCard({
  stats,
  weekPoints = 0,
  recentPoints = [],
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const sparkBars = recentPoints.slice(-10);

  return (
    <Card style={styles.card}>
      {/* Top section: week score + sparkline */}
      <View style={[styles.topSection, { borderBottomColor: colors.border }]}>
        <Text style={[styles.caption, { color: colors.mutedForeground }]}>THIS WEEK</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreLeft}>
            <Text style={[styles.bigScore, { color: colors.primary, fontFamily: 'JetBrainsMonoBold' }]}>
              {weekPoints}
            </Text>
            <Text style={[styles.ptsLabel, { color: colors.mutedForeground }]}>pts</Text>
          </View>
          {/* Sparkline */}
          {sparkBars.length > 0 && (
            <View style={styles.sparkline}>
              {sparkBars.map((pts, i) => {
                const barColor =
                  pts >= 6
                    ? colors.primary
                    : pts > 0
                    ? colors.primary + '55'
                    : colors.border;
                return (
                  <View
                    key={i}
                    style={[styles.sparkBar, { backgroundColor: barColor }]}
                  />
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Bottom 3-col stat strip */}
      <View style={styles.statStrip}>
        <StatCell
          value={`${stats.correctWinnerPct}%`}
          label="Outcome"
          color={colors.foreground}
          styles={styles}
        />
        <View style={[styles.vertDiv, { backgroundColor: colors.border }]} />
        <StatCell
          value={`${stats.exactScorePct}%`}
          label="Exact"
          color={colors.primary}
          styles={styles}
        />
        <View style={[styles.vertDiv, { backgroundColor: colors.border }]} />
        <StatCell
          value={stats.currentStreak > 0 ? `${stats.currentStreak}` : '—'}
          label="Streak"
          color={colors.warning}
          styles={styles}
        />
      </View>
    </Card>
  );
});

function StatCell({
  value,
  label,
  color,
  styles,
}: {
  value: string;
  label: string;
  color: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color, fontFamily: 'JetBrainsMonoBold' }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: { padding: 0, overflow: 'hidden' },
    topSection: {
      padding: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    caption: {
      fontSize: font.size.xs,
      fontWeight: font.weight.bold,
      letterSpacing: 0.8,
      marginBottom: spacing.xs,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    scoreLeft: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    bigScore: {
      fontSize: 44,
      fontWeight: '700',
      lineHeight: 48,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    ptsLabel: { fontSize: font.size.md, marginBottom: 8 },
    sparkline: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      height: 36,
      maxWidth: 140,
    },
    sparkBar: {
      flex: 1,
      height: 36,
      borderRadius: 2,
    },
    statStrip: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    statCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      gap: 2,
    },
    statValue: {
      fontSize: font.size.xl,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      color: c.mutedForeground,
      fontSize: font.size.xs,
    },
    vertDiv: {
      width: StyleSheet.hairlineWidth,
      marginVertical: spacing.sm,
    },
  });
}
