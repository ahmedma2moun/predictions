import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge, Card, Muted } from '@/components/ui';
import { ScoringBreakdown } from '@/components/ScoringBreakdown';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { LeaderboardEntry, LeaderboardUserPrediction } from '@/types/api';
import { formatKickoff } from '@/utils/format';

interface Props {
  item: LeaderboardEntry;
  index: number;
  myId: string | undefined;
  isCurrentPeriod: boolean;
  isExpanded: boolean;
  expandedLoading: boolean;
  expandedData: LeaderboardUserPrediction[] | null;
  onToggle: (userId: string) => void;
}

export const LeaderboardRow = memo(function LeaderboardRow({
  item, index, myId, isCurrentPeriod, isExpanded, expandedLoading, expandedData, onToggle,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isMe = myId === item.userId;

  return (
    <Card
      style={[
        styles.rowCard,
        isMe && { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftBorder },
      ]}
    >
      <Pressable
        onPress={() => onToggle(item.userId)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      >
        <Text style={[
          styles.rank,
          index < 3 ? { color: colors.gold } : { color: colors.mutedForeground },
        ]}>
          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
        </Text>
        <Avatar name={item.name} url={item.avatarUrl} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}{isMe ? ' (you)' : ''}
            </Text>
            <BadgeStrip badges={item.badges ?? []} currentStreak={item.currentStreak ?? 0} isCurrentPeriod={isCurrentPeriod} />
          </View>
          <Muted style={{ fontSize: font.size.xs }}>{item.predictionsCount} picks</Muted>
        </View>
        <Badge variant={isMe ? 'default' : 'outline'}>
          {item.totalPoints} pts
        </Badge>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.mutedForeground}
          style={{ marginLeft: 4 }}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.expandedBox}>
          {expandedLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : expandedData && expandedData.length > 0 ? (
            expandedData.map(p => <UserPredRow key={p.matchId} p={p} />)
          ) : (
            <Muted style={{ textAlign: 'center', fontSize: font.size.xs }}>
              No scored predictions in this period.
            </Muted>
          )}
        </View>
      )}
    </Card>
  );
});

const BADGE_META: Record<string, string> = {
  first_exact_score: '🎯',
  on_a_roll:         '🔥',
  perfect_week:      '⭐',
  group_champion:    '🏆',
};

function BadgeStrip({ badges, currentStreak, isCurrentPeriod }: { badges: string[]; currentStreak: number; isCurrentPeriod: boolean }) {
  // perfect_week only shows in past-period views (same rule as web)
  const visibleBadges = isCurrentPeriod ? badges.filter(b => b !== 'perfect_week') : badges;
  if (visibleBadges.length === 0 && currentStreak < 2) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1, flexShrink: 1 }}>
      {visibleBadges.map(b => (
        <Text key={b} style={{ fontSize: 11, lineHeight: 14 }}>{BADGE_META[b] ?? '🏅'}</Text>
      ))}
      {currentStreak >= 2 && (
        <Text style={{ fontSize: 11, color: '#fb923c', fontWeight: '600' }}>🔥{currentStreak}</Text>
      )}
    </View>
  );
}

const Avatar = memo(function Avatar({ name, url }: { name: string; url: string | null }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (url) {
    return <Image source={{ uri: url }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.foreground, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
});

const UserPredRow = memo(function UserPredRow({ p }: { p: LeaderboardUserPrediction }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const awarded = p.pointsAwarded > 0;
  return (
    <View style={styles.predTile}>
      <View style={styles.predTileTop}>
        <Text style={styles.predTeams} numberOfLines={1}>
          {p.homeTeamName}{' '}
          <Text style={{ color: colors.mutedForeground, fontWeight: font.weight.regular }}>vs</Text>
          {' '}{p.awayTeamName}
        </Text>
        <View style={styles.predTilePts}>
          <Badge variant={awarded ? 'default' : 'secondary'}>
            +{p.pointsAwarded} pts
          </Badge>
          {p.scoringBreakdown && p.scoringBreakdown.length > 0 && (
            <ScoringBreakdown rules={p.scoringBreakdown} />
          )}
        </View>
      </View>
      <View style={styles.predTileMeta}>
        <Muted style={{ fontSize: font.size.xs }}>{formatKickoff(p.kickoffTime)}</Muted>
        <Text style={styles.metaText}>
          Pick: <Text style={styles.mono}>{p.homeScore}–{p.awayScore}</Text>
        </Text>
        <Text style={styles.metaText}>
          Result: <Text style={styles.mono}>{p.result.homeScore}–{p.result.awayScore}</Text>
        </Text>
      </View>
    </View>
  );
});

function makeStyles(c: Palette) {
  return StyleSheet.create({
    rowCard: {
      padding: 0,
      marginBottom: spacing.xs,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
    },
    rank: {
      width: 28,
      textAlign: 'center',
      fontSize: font.size.sm,
      fontWeight: font.weight.bold,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accent,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
    },
    name: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      flexShrink: 1,
    },
    expandedBox: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      padding: spacing.md,
      gap: spacing.xs,
    },
    predTile: {
      backgroundColor: c.cardElevated,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      gap: 4,
    },
    predTileTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    predTilePts: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    predTeams: {
      flex: 1,
      color: c.foreground,
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
    },
    predTileMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    metaText: { color: c.mutedForeground, fontSize: font.size.xs },
    mono: { color: c.foreground, fontVariant: ['tabular-nums'] },
  });
}
