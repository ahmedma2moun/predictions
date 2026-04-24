import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Modal,
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
            <BadgeStrip
                badges={item.badges ?? []}
                isGroupChampion={item.isGroupChampion ?? false}
                exactScoreCount={item.exactScoreCount ?? 0}
                longestStreak={item.longestStreak ?? 0}
                isCurrentPeriod={isCurrentPeriod}
              />
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

function BadgesPopover({
  badges,
  exactScoreCount,
  longestStreak,
}: {
  badges: string[];
  exactScoreCount: number;
  longestStreak: number;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const hasExact = badges.includes('first_exact_score');
  const hasRoll  = badges.includes('on_a_roll');
  if (!hasExact && !hasRoll) return null;

  return (
    <>
      <Pressable
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
          pressed && { opacity: 0.6 },
        ]}
        accessibilityLabel="View badges"
      >
        <Ionicons name="medal-outline" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.lg,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              minWidth: 200,
              maxWidth: 300,
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }}
            onPress={e => e.stopPropagation()}
          >
            <Text style={{ color: colors.foreground, fontSize: font.size.sm, fontWeight: font.weight.semibold, marginBottom: spacing.sm }}>
              Badges
            </Text>
            <View style={{ gap: 6 }}>
              {hasExact && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg }}>
                  <Text style={{ color: colors.foreground, fontSize: font.size.xs }}>🎯 Exact Score</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: font.size.xs, fontVariant: ['tabular-nums'] }}>×{exactScoreCount}</Text>
                </View>
              )}
              {hasRoll && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg }}>
                  <Text style={{ color: colors.foreground, fontSize: font.size.xs }}>🔥 On a Roll</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: font.size.xs }}>longest: {longestStreak}</Text>
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function BadgeStrip({
  badges,
  isGroupChampion,
  exactScoreCount,
  longestStreak,
  isCurrentPeriod,
}: {
  badges: string[];
  isGroupChampion: boolean;
  exactScoreCount: number;
  longestStreak: number;
  isCurrentPeriod: boolean;
}) {
  const hasExact = badges.includes('first_exact_score');
  const hasRoll  = badges.includes('on_a_roll');
  const showPopover = isCurrentPeriod && (hasExact || hasRoll);

  if (!isGroupChampion && !showPopover) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 }}>
      {isGroupChampion && <Text style={{ fontSize: 13, lineHeight: 16 }}>🏆</Text>}
      {showPopover && (
        <BadgesPopover badges={badges} exactScoreCount={exactScoreCount} longestStreak={longestStreak} />
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
