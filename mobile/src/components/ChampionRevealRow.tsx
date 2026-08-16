import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Muted } from '@/components/ui';
import { font, radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import { formatKickoff } from '@/utils/format';
import type { ChampionBonusRevealPick, ChampionBonusRevealTeam } from '@/types/api';

interface Props {
  pickEntry: ChampionBonusRevealPick;
  team: ChampionBonusRevealTeam | undefined;
  isMe: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export const ChampionRevealRow = memo(function ChampionRevealRow({ pickEntry, team, isMe, isExpanded, onToggle }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View
      style={[
        styles.rowWrap,
        {
          backgroundColor: isMe ? colors.primarySoft : colors.card,
          borderColor: isMe ? colors.primarySoftBorder : colors.border,
        },
      ]}
    >
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
        {pickEntry.teamLogo ? (
          <Image source={{ uri: pickEntry.teamLogo }} style={{ width: 28, height: 28 }} contentFit="contain" alt={pickEntry.teamName} />
        ) : (
          <View style={[styles.fallbackLogo, { backgroundColor: colors.cardElevated }]}>
            <Text style={{ color: colors.foreground, fontSize: font.size.xxs, fontWeight: font.weight.bold }}>
              {pickEntry.teamName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {pickEntry.name ?? `User ${pickEntry.userId}`}
            </Text>
            {isMe && <Text style={[styles.youTag, { color: colors.primary }]}>· YOU</Text>}
          </View>
          <Muted style={{ fontSize: font.size.xs }} numberOfLines={1}>{pickEntry.teamName}</Muted>
        </View>
        <Text style={[styles.pts, { color: colors.foreground, fontFamily: 'JetBrainsMonoBold' }]}>
          +{pickEntry.totalBonus}
        </Text>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
      </Pressable>

      {isExpanded && (
        <View style={[styles.expandedBox, { borderTopColor: colors.border }]}>
          {!team || team.awards.length === 0 ? (
            <Muted style={{ textAlign: 'center', fontSize: font.size.xs }}>
              No games played yet since lock.
            </Muted>
          ) : (
            <>
              {team.awards.map(a => (
                <View
                  key={a.matchId}
                  style={[styles.awardRow, { backgroundColor: a.isWin ? 'rgba(34,197,94,0.10)' : colors.cardElevated }]}
                >
                  <Text style={[styles.awardGame, { color: colors.foreground }]}>Game {a.gameNumber}</Text>
                  <Text style={[styles.awardOpp, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {a.homeAway === 'home' ? 'vs' : '@'} {a.opponentName}
                    {a.teamScore !== null ? ` · ${a.teamScore}–${a.opponentScore}` : ''}
                  </Text>
                  <Muted style={{ fontSize: font.size.xxs }}>{formatKickoff(a.kickoffTime)}</Muted>
                  <Text
                    style={{
                      color: a.isWin ? colors.success : colors.mutedForeground,
                      fontWeight: font.weight.bold,
                      fontSize: font.size.xs,
                      fontFamily: 'JetBrainsMono',
                      textDecorationLine: a.isWin ? 'none' : 'line-through',
                    }}
                  >
                    +{a.points}
                  </Text>
                </View>
              ))}
              <Muted style={{ textAlign: 'right', fontSize: font.size.xxs }}>
                Next win = {team.nextWinPoints} pts
              </Muted>
            </>
          )}
        </View>
      )}
    </View>
  );
});

function makeStyles() {
  return StyleSheet.create({
    rowWrap: {
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 11,
      paddingHorizontal: 14,
    },
    fallbackLogo: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    name: { fontSize: font.size.sm, fontWeight: font.weight.semibold, flexShrink: 1 },
    youTag: { fontSize: font.size.xxs, fontWeight: font.weight.bold, letterSpacing: 0.5 },
    pts: { fontSize: 14, fontWeight: font.weight.bold, fontVariant: ['tabular-nums'] },
    expandedBox: {
      borderTopWidth: StyleSheet.hairlineWidth,
      padding: spacing.md,
      gap: spacing.xs,
    },
    awardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
    },
    awardGame: { fontSize: font.size.xs, fontWeight: font.weight.semibold, width: 56 },
    awardOpp: { fontSize: font.size.xs, flex: 1 },
  });
}
