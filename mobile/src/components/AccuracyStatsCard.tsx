import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Muted } from '@/components/ui';
import { font, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { AccuracyStats } from '@/types/api';

function StatItem({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.statItem}>
      <View style={styles.valueBox}>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Muted style={styles.statLabel}>{label}</Muted>
    </View>
  );
}

function LeagueStatItem({
  logo,
  name,
  styles,
}: {
  logo: string | null;
  name: string | null;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.statItem}>
      <View style={styles.valueBox}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={styles.leagueLogo}
            contentFit="contain"
            accessibilityLabel={name ?? 'Best League'}
          />
        ) : (
          <Text style={styles.statValue}>{name ?? '—'}</Text>
        )}
      </View>
      <Muted style={styles.statLabel}>Best League</Muted>
    </View>
  );
}

export const AccuracyStatsCard = memo(function AccuracyStatsCard({ stats }: { stats: AccuracyStats }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Card>
      <View style={styles.grid}>
        <StatItem label="Accuracy" value={`${stats.overallAccuracy}%`} styles={styles} />
        <StatItem label="Correct Winner" value={`${stats.correctWinnerPct}%`} styles={styles} />
        <StatItem label="Exact Score" value={`${stats.exactScorePct}%`} styles={styles} />
        <StatItem label="Total Points" value={`${stats.totalPoints}`} styles={styles} />
        <LeagueStatItem logo={stats.bestLeagueLogo} name={stats.bestLeagueName} styles={styles} />
        <StatItem
          label="Streak"
          value={stats.currentStreak > 0 ? `${stats.currentStreak}` : '—'}
          styles={styles}
        />
      </View>
      <Muted style={styles.footer}>
        Based on {stats.totalFinished} finished match{stats.totalFinished !== 1 ? 'es' : ''}
      </Muted>
    </Card>
  );
});

function makeStyles(c: Palette) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    statItem: { width: '33.333%', alignItems: 'center', paddingVertical: spacing.sm, gap: 2 },
    valueBox: { height: 28, alignItems: 'center', justifyContent: 'center' },
    statValue: {
      color: c.foreground,
      fontSize: font.size.lg,
      fontWeight: font.weight.bold,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    leagueLogo: { width: 28, height: 28 },
    statLabel: { fontSize: font.size.xs, textAlign: 'center', lineHeight: 15 },
    footer: { fontSize: font.size.xs, textAlign: 'center', marginTop: spacing.xs },
  });
}
