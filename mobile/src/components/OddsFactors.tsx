import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { font } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { MatchOddsFactors } from '@/types/api';

export type PredictedOutcome = 'homeWin' | 'draw' | 'awayWin';

export function getPredictedOutcome(homeScore: number, awayScore: number): PredictedOutcome {
  if (homeScore > awayScore) return 'homeWin';
  if (awayScore > homeScore) return 'awayWin';
  return 'draw';
}

/**
 * Compact 1/X/2 odds factors shown next to a finished match's result.
 * `picked` highlights the outcome the user predicted.
 * Mirrors the web `OddsFactors` component.
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
  const cells: Array<{ key: PredictedOutcome; label: string; value: number }> = [
    { key: 'homeWin', label: '1', value: odds.homeWin },
    { key: 'draw',    label: 'X', value: odds.draw },
    { key: 'awayWin', label: '2', value: odds.awayWin },
  ];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}>
      {cells.map(({ key, label, value }) => (
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
          {label} {value.toFixed(2)}
        </Text>
      ))}
    </View>
  );
}
