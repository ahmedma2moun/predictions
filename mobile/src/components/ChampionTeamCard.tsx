import { memo, useMemo } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { ChampionBonusAllowedTeam } from '@/types/api';

interface Props {
  team: ChampionBonusAllowedTeam;
  isPicked: boolean;
  isPicking: boolean;
  onPress: () => void;
}

export const ChampionTeamCard = memo(function ChampionTeamCard({ team, isPicked, isPicking, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  return (
    <Pressable
      onPress={onPress}
      disabled={isPicking}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: isPicked ? colors.warning : colors.border,
          backgroundColor: isPicked ? 'rgba(242,181,68,0.10)' : colors.card,
          opacity: isPicking ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.logoWrap}>
        {team.logo ? (
          <Image source={{ uri: team.logo }} style={{ width: 48, height: 48 }} contentFit="contain" alt={team.name} />
        ) : (
          <View style={[styles.fallbackLogo, { backgroundColor: colors.cardElevated }]}>
            <Text style={{ color: colors.foreground, fontWeight: font.weight.bold, fontSize: font.size.sm }}>
              {team.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        {isPicked && (
          <View style={[styles.checkBadge, { backgroundColor: colors.warning }]}>
            <Ionicons name="checkmark" size={11} color={colors.background} />
          </View>
        )}
      </View>
      <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
        {team.name}
      </Text>
    </Pressable>
  );
});

function makeStyles() {
  return StyleSheet.create({
    card: {
      flex: 1,
      minWidth: '28%',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 2,
    },
    logoWrap: { position: 'relative' },
    fallbackLogo: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
      textAlign: 'center',
    },
  });
}
