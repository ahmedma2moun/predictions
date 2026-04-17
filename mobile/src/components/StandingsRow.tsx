import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { MatchDetail } from '@/types/api';
import { ordinal } from '@/utils/format';

type Standing = MatchDetail['homeStanding'];

export function StandingsRow({ label, s }: { label: string; s: Standing }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!s) return null;
  const form = (s.form ?? '').slice(-5).split('');
  return (
    <View style={styles.standingsRow}>
      <Text style={styles.standingLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.standingCol}>{ordinal(s.position)}</Text>
      <Text style={styles.standingCol}>
        {s.won ?? 0}W {s.drawn ?? 0}D {s.lost ?? 0}L
      </Text>
      <Text style={styles.standingPts}>{s.points} pts</Text>
      <View style={styles.formRow}>
        {form.map((result, i) => (
          <View
            key={i}
            style={[
              styles.formDot,
              {
                backgroundColor:
                  result === 'W' ? colors.success
                  : result === 'D' ? colors.warning
                  : colors.destructive,
              },
            ]}
          >
            <Text style={styles.formText}>{result}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    standingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    standingLabel: { flex: 1, color: c.mutedForeground, fontSize: font.size.xs },
    standingCol: { color: c.foreground, fontSize: font.size.xs, minWidth: 56, textAlign: 'center' },
    standingPts: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      minWidth: 48,
      textAlign: 'center',
    },
    formRow: { flexDirection: 'row', gap: 2 },
    formDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    formText: { color: c.primaryForeground, fontSize: 9, fontWeight: font.weight.bold },
  });
}
