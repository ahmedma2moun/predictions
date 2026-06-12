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
import { Muted } from '@/components/ui';
import { ScoringBreakdown } from '@/components/ScoringBreakdown';
import { OddsFactors, getPredictedOutcome } from '@/components/OddsFactors';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { LeaderboardEntry, LeaderboardUserPrediction } from '@/types/api';
import { formatKickoff } from '@/utils/format';

const MEDALS = ['🥇', '🥈', '🥉'] as const;

interface Props {
  item: LeaderboardEntry;
  index: number;
  myId: string | undefined;
  isCurrentPeriod: boolean;
  isExpanded: boolean;
  expandedLoading: boolean;
  expandedData: LeaderboardUserPrediction[] | null;
  onToggle: (userId: string) => void;
  showMedal?: boolean;
}

export const LeaderboardRow = memo(function LeaderboardRow({
  item, index, myId, isCurrentPeriod, isExpanded, expandedLoading, expandedData, onToggle, showMedal,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isMe = myId === item.userId;
  const rank = index + 1;

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
      <Pressable
        onPress={() => onToggle(item.userId)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      >
        {/* Rank */}
        <View style={styles.rankBox}>
          {showMedal ? (
            <Text style={styles.medal}>{MEDALS[index]}</Text>
          ) : (
            <Text
              style={[
                styles.rank,
                { color: isMe ? colors.primary : colors.mutedForeground, fontFamily: 'JetBrainsMono' },
              ]}
            >
              {rank}
            </Text>
          )}
        </View>

        {/* Avatar */}
        <Avatar name={item.name} url={item.avatarUrl} size={32} />

        {/* Name + badges */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isMe && (
              <Text style={[styles.youTag, { color: colors.primary }]}>· YOU</Text>
            )}
            <BadgeStrip
              badges={item.badges ?? []}
              isGroupChampion={item.isGroupChampion ?? false}
              exactScoreCount={item.exactScoreCount ?? 0}
              longestStreak={item.longestStreak ?? 0}
              isCurrentPeriod={isCurrentPeriod}
            />
          </View>
        </View>

        {/* Points */}
        <Text style={[styles.pts, { color: isMe ? colors.primary : colors.foreground, fontFamily: 'JetBrainsMonoBold' }]}>
          {item.totalPoints}
        </Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.mutedForeground}
        />
      </Pressable>

      {isExpanded && (
        <View style={[styles.expandedBox, { borderTopColor: colors.border }]}>
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
    </View>
  );
});

// ── Podium (top 3) ────────────────────────────────────────────────────────────

const MEDAL = {
  1: { color: '#F2C744', bg: 'rgba(242,199,68,0.33)', border: 'rgba(242,199,68,0.55)', height: 86 },
  2: { color: '#C5CDD9', bg: 'rgba(197,205,217,0.33)', border: 'rgba(197,205,217,0.55)', height: 62 },
  3: { color: '#CB8C5C', bg: 'rgba(203,140,92,0.33)', border: 'rgba(203,140,92,0.55)', height: 48 },
} as const;

export function Podium({ entries, myId }: { entries: LeaderboardEntry[]; myId: string | undefined }) {
  const { colors } = useTheme();
  const top3 = entries.slice(0, 3);
  if (top3.length < 3) return null;

  // Display order: 2nd | 1st | 3rd
  const order = [top3[1], top3[0], top3[2]];
  const ranks = [2, 1, 3] as const;

  return (
    <View style={podiumStyles.row}>
      {order.map((entry, i) => {
        const rank = ranks[i];
        const medal = MEDAL[rank];
        const isMe = entry.userId === myId;
        return (
          <View key={entry.userId} style={[podiumStyles.col, rank === 1 && podiumStyles.colFirst]}>
            <Avatar name={entry.name} url={entry.avatarUrl} size={rank === 1 ? 48 : 40} />
            <Text
              style={[podiumStyles.name, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {entry.name.split(' ')[0]}
            </Text>
            <Text
              style={[podiumStyles.score, { color: colors.foreground, fontFamily: 'JetBrainsMonoBold' }]}
            >
              {entry.totalPoints}
            </Text>
            {/* Tower */}
            <View
              style={[
                podiumStyles.tower,
                {
                  height: medal.height,
                  backgroundColor: medal.bg,
                  borderColor: medal.border,
                },
              ]}
            >
              <Text style={[podiumStyles.towerNum, { color: medal.color }]}>{rank}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const podiumStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  colFirst: { flex: 1.2 },
  name: { fontSize: 11.5, fontWeight: '600', textAlign: 'center' },
  score: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tower: {
    width: '100%',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  towerNum: { fontSize: 20, fontWeight: '800' },
});

// ── Avatar ────────────────────────────────────────────────────────────────────
export const Avatar = memo(function Avatar({
  name, url, size = 32,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  const { colors } = useTheme();
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.foreground, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
});

// ── Badge strip ───────────────────────────────────────────────────────────────
function BadgesPopover({
  badges, exactScoreCount, longestStreak,
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
        <Ionicons name="medal-outline" size={13} color={colors.mutedForeground} />
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
                  <Text style={{ color: colors.mutedForeground, fontSize: font.size.xs, fontFamily: 'JetBrainsMono', fontVariant: ['tabular-nums'] }}>
                    ×{exactScoreCount}
                  </Text>
                </View>
              )}
              {hasRoll && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg }}>
                  <Text style={{ color: colors.foreground, fontSize: font.size.xs }}>🔥 On a Roll</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: font.size.xs }}>
                    longest: {longestStreak}
                  </Text>
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
  badges, isGroupChampion, exactScoreCount, longestStreak, isCurrentPeriod,
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
      {isGroupChampion && <Text style={{ fontSize: 12, lineHeight: 16 }}>🏆</Text>}
      {showPopover && (
        <BadgesPopover badges={badges} exactScoreCount={exactScoreCount} longestStreak={longestStreak} />
      )}
    </View>
  );
}

// ── Expanded prediction row ───────────────────────────────────────────────────
const UserPredRow = memo(function UserPredRow({ p }: { p: LeaderboardUserPrediction }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const awarded = p.pointsAwarded > 0;
  return (
    <View style={[styles.predTile, { backgroundColor: colors.cardElevated }]}>
      <View style={styles.predTileTop}>
        <Text style={[styles.predTeams, { color: colors.foreground }]} numberOfLines={1}>
          {p.homeTeamName}{' '}
          <Text style={{ color: colors.mutedForeground, fontWeight: font.weight.regular }}>vs</Text>
          {' '}{p.awayTeamName}
        </Text>
        <View style={styles.predTilePts}>
          <Text style={{ color: awarded ? colors.warning : colors.mutedForeground, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>
            +{p.pointsAwarded} pts
          </Text>
          {p.scoringBreakdown && p.scoringBreakdown.length > 0 && (
            <ScoringBreakdown rules={p.scoringBreakdown} bonus={p.oddsBonus} />
          )}
        </View>
      </View>
      <View style={styles.predTileMeta}>
        <Muted style={{ fontSize: font.size.xs }}>{formatKickoff(p.kickoffTime)}</Muted>
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          Pick: <Text style={{ color: colors.foreground, fontFamily: 'JetBrainsMono', fontVariant: ['tabular-nums'] }}>{p.homeScore}–{p.awayScore}</Text>
        </Text>
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          Result: <Text style={{ color: colors.foreground, fontFamily: 'JetBrainsMono', fontVariant: ['tabular-nums'] }}>{p.result.homeScore}–{p.result.awayScore}</Text>
        </Text>
        {p.matchOdds && (
          <OddsFactors odds={p.matchOdds} picked={getPredictedOutcome(p.homeScore, p.awayScore)} />
        )}
      </View>
    </View>
  );
});

function makeStyles(c: Palette) {
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
    rankBox: { width: 26, alignItems: 'center' },
    rank: {
      fontSize: font.size.sm,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },
    medal: { fontSize: 16, lineHeight: 20 },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
    },
    name: {
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      flexShrink: 1,
    },
    youTag: {
      fontSize: font.size.xxs,
      fontWeight: font.weight.bold,
      letterSpacing: 0.5,
      flexShrink: 0,
    },
    pts: {
      fontSize: 14,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },
    expandedBox: {
      borderTopWidth: StyleSheet.hairlineWidth,
      padding: spacing.md,
      gap: spacing.xs,
    },
    predTile: {
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
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
    },
    predTileMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    metaText: { fontSize: font.size.xs },
  });
}
