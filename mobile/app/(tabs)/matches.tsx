import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Card, Muted } from '@/components/ui';
import { colors, font, radius, spacing } from '@/theme/colors';
import type { MatchListItem } from '@/types/api';
import { formatKickoff, formatStage, isKnockoutStage, isMatchLocked, ordinal } from '@/utils/format';

export default function MatchesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      // Web Matches page shows scheduled + live only; match that.
      const data = await apiRequest<MatchListItem[]>(
        '/api/mobile/matches?status=scheduled',
        { token },
      );
      const live = await apiRequest<MatchListItem[]>(
        '/api/mobile/matches?status=live',
        { token },
      );
      const merged = [...live, ...data].sort(
        (a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime(),
      );
      setMatches(merged);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <Text style={styles.heading}>Upcoming Matches</Text>
      }
      ListEmptyComponent={
        <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
          {error ?? 'No upcoming matches available.'}
        </Muted>
      }
      renderItem={({ item }) => (
        <MatchRow match={item} onPress={() => router.push(`/matches/${item._id}`)} />
      )}
    />
  );
}

function MatchRow({ match, onPress }: { match: MatchListItem; onPress: () => void }) {
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
            <Badge variant={match.status === 'live' ? 'destructive' : 'outline'}>
              {match.status.toUpperCase()}
            </Badge>
          </View>
        </View>

        {headerLabel && (
          <Text style={styles.headerLabel}>{headerLabel}</Text>
        )}

        <View style={styles.teamsRow}>
          <TeamSide
            name={match.homeTeam.name}
            logo={match.homeTeam.logo}
            standing={match.homeStanding}
          />
          <View style={styles.scoreCenter}>
            {match.prediction ? (
              <Text style={styles.predictionScore}>
                {match.prediction.homeScore} – {match.prediction.awayScore}
              </Text>
            ) : (
              <Muted>vs</Muted>
            )}
          </View>
          <TeamSide
            name={match.awayTeam.name}
            logo={match.awayTeam.logo}
            standing={match.awayStanding}
          />
        </View>

        {match.prediction && (
          <Muted style={{ textAlign: 'center', marginTop: spacing.xs, fontSize: font.size.xs }}>
            Your prediction ✓
          </Muted>
        )}
      </Card>
    </Pressable>
  );
}

function TeamSide({
  name,
  logo,
  standing,
}: {
  name: string;
  logo: string | null;
  standing: { position: number; points: number } | null;
}) {
  return (
    <View style={styles.teamSide}>
      <Text style={styles.teamName} numberOfLines={2}>{name}</Text>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  heading: {
    color: colors.foreground,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    marginBottom: spacing.sm,
  },
  matchCard: { marginBottom: spacing.md, paddingVertical: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerLabel: {
    textAlign: 'center',
    color: colors.mutedForeground,
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
    color: colors.foreground,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    textAlign: 'center',
  },
  logo: { width: 32, height: 32 },
  standing: { color: colors.mutedForeground, fontSize: font.size.xs },
  scoreCenter: { paddingHorizontal: spacing.md, minWidth: 70, alignItems: 'center' },
  predictionScore: {
    color: colors.foreground,
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    fontVariant: ['tabular-nums'],
  },
});
