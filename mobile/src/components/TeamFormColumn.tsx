import { useMemo } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Muted } from '@/components/ui';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { TeamFormMatch } from '@/types/api';

const resultColor = (c: Palette, result: 'W' | 'D' | 'L' | null) => {
  if (result === 'W') return { bg: c.primary + '26', fg: c.primary };
  if (result === 'L') return { bg: '#EF444426', fg: '#EF4444' };
  return { bg: c.cardElevated, fg: c.mutedForeground };
};

export function TeamFormColumn({ teamName, matches }: { teamName?: string; matches: TeamFormMatch[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.column}>
      <Text style={styles.teamName} numberOfLines={1}>{teamName ?? '—'}</Text>
      <View style={styles.badgeRow}>
        {matches.map((m, i) => {
          const { bg, fg } = resultColor(colors, m.result);
          return (
            <View key={i} style={[styles.badge, { backgroundColor: bg }]}>
              <Text style={[styles.badgeText, { color: fg }]}>{m.result ?? '–'}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ gap: spacing.xs }}>
        {matches.map((m, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.rowOpponent}>
              {m.opponentLogo && (
                <Image source={{ uri: m.opponentLogo }} style={styles.logo} contentFit="contain" alt={m.opponentName} />
              )}
              <Muted style={styles.opponentName} numberOfLines={1}>
                {m.isHome ? 'vs' : '@'} {m.opponentName}
              </Muted>
            </View>
            <Text style={[styles.score, { color: colors.foreground }]}>
              {m.teamScore ?? '–'}-{m.opponentScore ?? '–'}
            </Text>
          </View>
        ))}
        {matches.length === 0 && <Muted style={{ fontSize: font.size.xs }}>No recent games</Muted>}
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    column: { flex: 1, minWidth: 0, gap: spacing.xs },
    teamName: { color: c.foreground, fontSize: font.size.xs, fontWeight: font.weight.medium },
    badgeRow: { flexDirection: 'row', gap: 4 },
    badge: { width: 20, height: 20, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontSize: font.size.xxs, fontWeight: font.weight.bold },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
    rowOpponent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
    logo: { width: 14, height: 14 },
    opponentName: { fontSize: font.size.xs, flexShrink: 1 },
    score: { fontSize: font.size.xs, fontWeight: font.weight.semibold, fontVariant: ['tabular-nums'] },
  });
}
