import { useMemo } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Muted } from '@/components/ui';
import { font, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { H2HMatch } from '@/types/api';
import { formatH2HDate } from '@/utils/format';

export function H2HRow({ m }: { m: H2HMatch }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const winner =
    m.homeScore !== null && m.awayScore !== null
      ? m.homeScore > m.awayScore ? 'home'
        : m.awayScore > m.homeScore ? 'away'
        : 'draw'
      : null;
  const homeStrong = winner === 'home';
  const awayStrong = winner === 'away';
  const homeDim = winner !== null && winner !== 'draw' && winner !== 'home';
  const awayDim = winner !== null && winner !== 'draw' && winner !== 'away';

  return (
    <View style={styles.h2hRow}>
      <View style={styles.h2hMeta}>
        <Muted style={{ fontSize: font.size.xs }}>{formatH2HDate(m.date)}</Muted>
        <Muted style={{ fontSize: font.size.xs, maxWidth: 140 }} numberOfLines={1}>{m.competition}</Muted>
      </View>
      <View style={styles.h2hTeams}>
        <View style={styles.h2hTeamLeft}>
          {m.homeTeamLogo && (
            <Image source={{ uri: m.homeTeamLogo }} style={styles.h2hLogo} contentFit="contain" />
          )}
          <Text
            numberOfLines={1}
            style={[
              styles.h2hTeamName,
              homeStrong && { fontWeight: font.weight.semibold },
              homeDim && { color: colors.mutedForeground },
            ]}
          >
            {m.homeTeamName}
          </Text>
        </View>
        <View style={styles.h2hScoreBox}>
          <Text style={styles.h2hScore}>
            {m.homeScore ?? '–'} – {m.awayScore ?? '–'}
          </Text>
          {m.penaltyHomeScore != null && (
            <Muted style={{ fontSize: font.size.xxs, textAlign: 'center' }}>
              ({m.penaltyHomeScore} – {m.penaltyAwayScore} pen)
            </Muted>
          )}
        </View>
        <View style={styles.h2hTeamRight}>
          <Text
            numberOfLines={1}
            style={[
              styles.h2hTeamName,
              { textAlign: 'right' },
              awayStrong && { fontWeight: font.weight.semibold },
              awayDim && { color: colors.mutedForeground },
            ]}
          >
            {m.awayTeamName}
          </Text>
          {m.awayTeamLogo && (
            <Image source={{ uri: m.awayTeamLogo }} style={styles.h2hLogo} contentFit="contain" />
          )}
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    h2hRow: { gap: 4, paddingVertical: spacing.xs },
    h2hMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    h2hTeams: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    h2hTeamLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    h2hTeamRight: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      minWidth: 0,
    },
    h2hLogo: { width: 16, height: 16 },
    h2hTeamName: { color: c.foreground, fontSize: font.size.sm, flexShrink: 1 },
    h2hScoreBox: { width: 64, alignItems: 'center' },
    h2hScore: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },
  });
}
