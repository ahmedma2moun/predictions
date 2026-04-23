import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge, Card, Muted } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { useMatches } from '@/hooks/useMatches';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { MatchListItem } from '@/types/api';
import { formatKickoff, formatMatchStatus, formatStage, isKnockoutStage, isMatchLocked, ordinal } from '@/utils/format';

export default function MatchesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { matches, loading, refreshing, error, onRefresh } = useMatches();

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) { isFirstFocus.current = false; return; }
      onRefresh();
    }, [onRefresh]),
  );

  const renderMatchItem = useCallback(({ item }: { item: MatchListItem }) => (
    <MatchRow match={item} onPress={() => router.push(ROUTES.matchDetail(item._id) as any)} />
  ), [router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={matches}
      keyExtractor={item => item._id}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={<Text style={styles.heading}>Upcoming Matches</Text>}
      ListEmptyComponent={
        <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
          {error ?? 'No upcoming matches available.'}
        </Muted>
      }
      renderItem={renderMatchItem}
    />
  );
}

const MatchRow = memo(function MatchRow({ match, onPress }: { match: MatchListItem; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const locked = isMatchLocked(match.kickoffTime);
  const knockout = isKnockoutStage(match.stage);
  const headerLabel = knockout
    ? `${formatStage(match.stage!)}${match.leg ? ` · Leg ${match.leg}` : ''}`
    : match.matchday
    ? `Matchday ${match.matchday}`
    : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card style={styles.matchCard}>
        <View style={styles.cardTop}>
          <Muted style={{ fontSize: font.size.xs }}>{formatKickoff(match.kickoffTime)}</Muted>
          <View style={styles.cardTopRight}>
            {locked && match.status !== 'finished' && (
              <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} />
            )}
            {match.prediction && (
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            )}
            {match.status !== 'scheduled' && (
              <Badge variant={match.status === 'live' ? 'destructive' : 'outline'}>
                {formatMatchStatus(match.status)}
              </Badge>
            )}
          </View>
        </View>

        {headerLabel && <Text style={styles.headerLabel}>{headerLabel}</Text>}
        {!locked && <CountdownText kickoffTime={match.kickoffTime} />}

        <View style={styles.teamsRow}>
          <TeamSide name={match.homeTeam.name} logo={match.homeTeam.logo} standing={match.homeStanding} />
          <View style={styles.scoreCenter}>
            {match.prediction ? (
              <Text style={styles.predictionScore}>
                {match.prediction.homeScore} – {match.prediction.awayScore}
              </Text>
            ) : (
              <Muted>vs</Muted>
            )}
          </View>
          <TeamSide name={match.awayTeam.name} logo={match.awayTeam.logo} standing={match.awayStanding} />
        </View>

        {match.prediction && (
          <Muted style={{ textAlign: 'center', marginTop: spacing.xs, fontSize: font.size.xs }}>
            Your prediction ✓
          </Muted>
        )}
      </Card>
    </Pressable>
  );
});

function TeamSide({
  name, logo, standing,
}: {
  name: string;
  logo: string | null;
  standing: { position: number; points: number } | null;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.teamSide}>
      <Text style={styles.teamName} numberOfLines={2}>{name}</Text>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" />
      ) : (
        <View style={[styles.logo, { backgroundColor: colors.accent, borderRadius: radius.md }]} />
      )}
      {standing && (
        <Text style={styles.standing}>
          {ordinal(standing.position)} · {standing.points} pts
        </Text>
      )}
    </View>
  );
}

function getCountdownLabel(kickoffTime: string): string | null {
  const ms = new Date(kickoffTime).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return remainHours > 0 ? `${days}d ${remainHours}h left to predict` : `${days}d left to predict`;
  }
  if (hours > 0) return `${hours}h ${minutes}m left to predict`;
  if (totalMinutes > 0) return `${totalMinutes}m left to predict`;
  return '< 1m left to predict';
}

function CountdownText({ kickoffTime }: { kickoffTime: string }) {
  const { colors } = useTheme();
  const [label, setLabel] = useState(() => getCountdownLabel(kickoffTime));

  useEffect(() => {
    const intervalId = setInterval(() => setLabel(getCountdownLabel(kickoffTime)), 30_000);
    const ms = new Date(kickoffTime).getTime() - Date.now();
    const timeoutId = ms > 0 ? setTimeout(() => { setLabel(null); clearInterval(intervalId); }, ms) : null;
    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [kickoffTime]);

  if (!label) return null;
  return (
    <Text style={{ color: colors.warning, fontSize: font.size.xs, textAlign: 'center', marginTop: 4 }}>
      ⏱ {label}
    </Text>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    heading: {
      color: c.foreground,
      fontSize: font.size.xl,
      fontWeight: font.weight.bold,
      marginBottom: spacing.sm,
    },
    matchCard: { marginBottom: spacing.md, paddingVertical: spacing.md },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    headerLabel: {
      textAlign: 'center',
      color: c.mutedForeground,
      fontSize: font.size.xs,
      marginTop: spacing.xs,
    },
    teamsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    teamSide: { flex: 1, alignItems: 'center', gap: 6 },
    teamName: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      textAlign: 'center',
    },
    logo: { width: 32, height: 32 },
    standing: { color: c.mutedForeground, fontSize: font.size.xs },
    scoreCenter: { paddingHorizontal: spacing.md, minWidth: 70, alignItems: 'center' },
    predictionScore: {
      color: c.foreground,
      fontSize: font.size.lg,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },
  });
}
