import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/LeaderboardRow';
import { LiveDot, Muted } from '@/components/ui';
import { useLiveStanding } from '@/hooks/useLiveStanding';
import type { LiveStandingEntry, LiveStandingMatch } from '@/types/api';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

function MovementArrow({ entry }: { entry: LiveStandingEntry }) {
  const { colors } = useTheme();
  if (entry.movement === 'up') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Ionicons name="arrow-up" size={15} color={colors.success} />
        <Text style={{ color: colors.success, fontSize: font.size.xs, fontWeight: font.weight.bold, fontFamily: 'JetBrainsMono' }}>
          {entry.previousRank - entry.rank}
        </Text>
      </View>
    );
  }
  if (entry.movement === 'down') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Ionicons name="arrow-down" size={15} color={colors.destructive} />
        <Text style={{ color: colors.destructive, fontSize: font.size.xs, fontWeight: font.weight.bold, fontFamily: 'JetBrainsMono' }}>
          {entry.rank - entry.previousRank}
        </Text>
      </View>
    );
  }
  return <Ionicons name="remove" size={15} color={colors.mutedForeground} />;
}

function LiveMatchCard({ match }: { match: LiveStandingMatch }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.matchCard}>
      <View style={[styles.matchTeam, { justifyContent: 'flex-end' }]}>
        <Text style={styles.matchTeamName} numberOfLines={1}>{match.homeTeamName}</Text>
        {match.homeTeamLogo && <Image source={{ uri: match.homeTeamLogo }} style={styles.matchLogo} contentFit="contain" />}
      </View>
      <Text style={styles.matchScore}>{match.homeScore}–{match.awayScore}</Text>
      <View style={styles.matchTeam}>
        {match.awayTeamLogo && <Image source={{ uri: match.awayTeamLogo }} style={styles.matchLogo} contentFit="contain" />}
        <Text style={styles.matchTeamName} numberOfLines={1}>{match.awayTeamName}</Text>
      </View>
      <View style={styles.liveBadge}>
        <LiveDot />
        <Text style={styles.liveBadgeText}>{match.status === 'finished' ? 'FT' : 'LIVE'}</Text>
      </View>
    </View>
  );
}

export default function LiveStandingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const {
    myId,
    groups, groupId, setGroupId,
    data,
    loading,
    refreshing, onRefresh,
    lastUpdated,
  } = useLiveStanding();

  const standings = data?.standings ?? [];
  const groupName = groups.find(g => g.id === groupId)?.name;
  const subtitle = lastUpdated
    ? `${groupName ? `${groupName} · ` : ''}updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : groupName;

  const renderItem = useCallback(
    ({ item }: { item: LiveStandingEntry }) => {
      const isMe = item.userId === myId;
      const name = item.name ?? 'Unknown';
      return (
        <View
          style={[
            styles.row,
            {
              backgroundColor: isMe ? colors.primarySoft : colors.card,
              borderColor: isMe ? colors.primarySoftBorder : colors.border,
            },
          ]}
        >
          <Text style={[styles.rank, { color: isMe ? colors.primary : colors.mutedForeground }]}>
            {item.rank}
          </Text>
          <View style={styles.arrowBox}>
            <MovementArrow entry={item} />
          </View>
          <Avatar name={name} url={item.avatarUrl} size={30} />
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
            {isMe && <Text style={[styles.youTag, { color: colors.primary }]}>· YOU</Text>}
          </View>
          {item.livePoints > 0 && (
            <View style={[styles.livePointsPill, { backgroundColor: `${colors.success}1F` }]}>
              <Text style={[styles.livePointsText, { color: colors.success }]}>+{item.livePoints}</Text>
            </View>
          )}
          <Text style={[styles.points, { color: colors.foreground }]}>{item.liveTotalPoints}</Text>
        </View>
      );
    },
    [myId, colors, styles],
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Live Standing" subtitle={subtitle} />
      <FlatList
        data={standings}
        keyExtractor={e => e.userId}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        style={{ backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            {groups.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {groups.map(g => {
                  const active = g.id === groupId;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => setGroupId(g.id)}
                      style={[
                        styles.groupChip,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? colors.primaryForeground : colors.mutedForeground,
                          fontSize: font.size.sm,
                          fontWeight: font.weight.medium,
                        }}
                      >
                        {g.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {data?.hasLiveMatches ? (
              <View style={{ gap: spacing.xs }}>
                {data.matches.map(m => <LiveMatchCard key={m.matchId} match={m} />)}
              </View>
            ) : (
              <View style={styles.noLiveBox}>
                <Muted style={{ textAlign: 'center', fontSize: font.size.xs }}>
                  No matches in play right now — the standing shows confirmed points and updates automatically once a match kicks off.
                </Muted>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
            No standings yet
          </Muted>
        }
        renderItem={renderItem}
      />
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: spacing.lg, gap: spacing.xs, paddingTop: spacing.sm },
    groupChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    matchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    matchTeam: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
    matchTeamName: { color: c.foreground, fontSize: font.size.sm, fontWeight: font.weight.semibold, flexShrink: 1 },
    matchLogo: { width: 18, height: 18 },
    matchScore: { color: c.foreground, fontSize: font.size.md, fontWeight: font.weight.bold, fontFamily: 'JetBrainsMono' },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(255,77,109,0.30)',
      backgroundColor: 'rgba(255,77,109,0.12)',
    },
    liveBadgeText: { color: c.live, fontSize: 10, fontWeight: font.weight.bold },
    noLiveBox: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 3,
    },
    rank: {
      width: 22,
      textAlign: 'center',
      fontSize: font.size.sm,
      fontWeight: font.weight.bold,
      fontFamily: 'JetBrainsMono',
    },
    arrowBox: { width: 30, alignItems: 'center' },
    name: { fontSize: font.size.sm, fontWeight: font.weight.semibold, flexShrink: 1 },
    youTag: { fontSize: 10, fontWeight: font.weight.bold },
    livePointsPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    livePointsText: { fontSize: 10, fontWeight: font.weight.bold, fontFamily: 'JetBrainsMono' },
    points: { fontSize: font.size.md, fontWeight: font.weight.bold, fontFamily: 'JetBrainsMono' },
  });
}
