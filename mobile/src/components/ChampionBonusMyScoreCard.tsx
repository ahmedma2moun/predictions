import { useMemo } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Muted } from '@/components/ui';
import { useChampionBonus } from '@/hooks/useChampionBonus';
import { ROUTES } from '@/constants/routes';
import { font, radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

export function ChampionBonusMyScoreCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const { state } = useChampionBonus();

  if (!state || !state.enabled) return null;

  if (state.status === 'OPEN') {
    return (
      <Pressable
        onPress={() => router.push(ROUTES.champion)}
        style={({ pressed }) => [styles.card, { backgroundColor: 'rgba(242,181,68,0.10)', borderColor: colors.warning, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>👑 Champion Bonus</Text>
        <Muted style={{ fontSize: font.size.xs, marginTop: 2 }}>
          {state.myPick ? "You've picked your champion" : 'Pick your champion before picks lock'}
        </Muted>
      </Pressable>
    );
  }

  const myTeam = state.myPick ? state.teams[state.myPick.teamId] : null;
  if (!myTeam) {
    return (
      <Pressable
        onPress={() => router.push(ROUTES.champion)}
        style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
      >
        <Muted style={{ fontSize: font.size.sm }}>👑 Champion Bonus — you didn&apos;t pick a champion this round</Muted>
      </Pressable>
    );
  }

  const wins = myTeam.awards.filter(a => a.isWin).length;

  return (
    <Pressable
      onPress={() => router.push(ROUTES.champion)}
      style={({ pressed }) => [styles.card, { backgroundColor: 'rgba(242,181,68,0.10)', borderColor: colors.warning, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[styles.title, { color: colors.foreground }]}>👑 Champion Bonus ({myTeam.name})</Text>
        <Text style={{ color: colors.foreground, fontWeight: font.weight.bold, fontFamily: 'JetBrainsMonoBold' }}>
          +{myTeam.totalPoints} pts
        </Text>
      </View>
      <Muted style={{ fontSize: font.size.xs, marginTop: 2 }}>
        {myTeam.awards.length} game{myTeam.awards.length !== 1 ? 's' : ''} played · {wins} win{wins !== 1 ? 's' : ''} · next win = {myTeam.nextWinPoints} pts
      </Muted>
    </Pressable>
  );
}

function makeStyles() {
  return StyleSheet.create({
    card: {
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
    },
    title: { fontSize: font.size.sm, fontWeight: font.weight.semibold },
  });
}
