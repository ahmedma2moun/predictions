import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/lib/constants';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type Standing = { position: number; points: number } | null;

type Prediction = {
  homeScore:       number;
  awayScore:       number;
  predictedWinner: string | null;
  pointsAwarded:   number | null;
} | null;

type Match = {
  _id:         string;
  kickoffTime: string;
  status:      'scheduled' | 'live' | 'finished';
  stage:       string | null;
  leg:         number | null;
  matchday:    number | null;
  homeTeam:    { name: string; logo?: string | null };
  awayTeam:    { name: string; logo?: string | null };
  result:      { homeScore: number; awayScore: number } | null;
  leagueName:  string | null;
  prediction:  Prediction;
  homeStanding: Standing;
  awayStanding: Standing;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const KNOCKOUT_STAGES = new Set([
  'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL',
  'ROUND_OF_16', 'THIRD_PLACE',
]);

function isKnockout(stage: string | null): boolean {
  return !!stage && KNOCKOUT_STAGES.has(stage);
}

function formatStage(stage: string): string {
  const map: Record<string, string> = {
    LAST_16:       'Round of 16',
    ROUND_OF_16:   'Round of 16',
    QUARTER_FINALS: 'Quarter Finals',
    SEMI_FINALS:   'Semi Finals',
    FINAL:         'Final',
    THIRD_PLACE:   '3rd Place',
  };
  return map[stage] ?? stage.replace(/_/g, ' ');
}

function isLocked(kickoffTime: string): boolean {
  return Date.now() >= new Date(kickoffTime).getTime();
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' · '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Match card ─────────────────────────────────────────────────────────────────

function MatchCard({ match }: { match: Match }) {
  const locked = isLocked(match.kickoffTime);

  function statusBadgeColor() {
    if (match.status === 'live')     return Colors.destructive;
    if (match.status === 'finished') return Colors.textDim;
    return Colors.textMuted;
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/match/${match._id}`)}
      activeOpacity={0.75}
    >
      {/* Top row: time + badges */}
      <View style={styles.cardTop}>
        <Text style={styles.kickoff}>{formatKickoff(match.kickoffTime)}</Text>
        <View style={styles.badgeRow}>
          {locked && <Ionicons name="lock-closed" size={12} color={Colors.textMuted} />}
          {match.prediction && (
            <Ionicons name="checkmark-circle" size={14} color={Colors.green} />
          )}
          <View style={[styles.statusBadge, { borderColor: statusBadgeColor() }]}>
            <Text style={[styles.statusText, { color: statusBadgeColor() }]}>
              {match.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Stage / matchday subtitle */}
      {isKnockout(match.stage) ? (
        <Text style={styles.stageLine}>
          {formatStage(match.stage!)}
          {match.leg ? ` · Leg ${match.leg}` : ''}
        </Text>
      ) : match.matchday ? (
        <Text style={styles.stageLine}>Matchday {match.matchday}</Text>
      ) : match.leagueName ? (
        <Text style={styles.stageLine}>{match.leagueName}</Text>
      ) : null}

      {/* Teams */}
      <View style={styles.teamsRow}>
        {/* Home */}
        <View style={styles.teamCol}>
          {match.homeTeam.logo
            ? <Image source={{ uri: match.homeTeam.logo }} style={styles.teamLogo} resizeMode="contain" />
            : <View style={styles.teamLogoPlaceholder} />}
          <Text style={styles.teamName} numberOfLines={1}>{match.homeTeam.name}</Text>
          {match.homeStanding && (
            <Text style={styles.standing}>
              {ordinal(match.homeStanding.position)} · {match.homeStanding.points} pts
            </Text>
          )}
        </View>

        {/* Centre: prediction or vs */}
        <View style={styles.centreCol}>
          {match.prediction ? (
            <Text style={styles.predScore}>
              {match.prediction.homeScore} – {match.prediction.awayScore}
            </Text>
          ) : match.result ? (
            <Text style={styles.resultScore}>
              {match.result.homeScore} – {match.result.awayScore}
            </Text>
          ) : (
            <Text style={styles.vs}>vs</Text>
          )}
        </View>

        {/* Away */}
        <View style={styles.teamCol}>
          {match.awayTeam.logo
            ? <Image source={{ uri: match.awayTeam.logo }} style={styles.teamLogo} resizeMode="contain" />
            : <View style={styles.teamLogoPlaceholder} />}
          <Text style={styles.teamName} numberOfLines={1}>{match.awayTeam.name}</Text>
          {match.awayStanding && (
            <Text style={styles.standing}>
              {ordinal(match.awayStanding.position)} · {match.awayStanding.points} pts
            </Text>
          )}
        </View>
      </View>

      {match.prediction && (
        <Text style={styles.predLabel}>Your prediction ✓</Text>
      )}
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function MatchesScreen() {
  const [matches,    setMatches]    = useState<Match[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await api.get<Match[]>('/api/mobile/matches');
      setMatches(res.data);
      setError(null);
    } catch {
      setError('Failed to load matches.');
    }
  }, []);

  useEffect(() => {
    fetchMatches().finally(() => setLoading(false));
  }, [fetchMatches]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchMatches()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={matches}
      keyExtractor={(m) => m._id}
      renderItem={({ item }) => <MatchCard match={item} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No upcoming matches available.</Text>
        </View>
      }
    />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: { padding: 12, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
  },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  kickoff: { fontSize: 11, color: Colors.textMuted },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  statusText: { fontSize: 10, fontWeight: '600' },

  stageLine: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginBottom: 8 },

  teamsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  teamCol:  { flex: 1, alignItems: 'center', gap: 4 },
  teamLogo: { width: 36, height: 36 },
  teamLogoPlaceholder: { width: 36, height: 36, backgroundColor: Colors.muted, borderRadius: 18 },
  teamName: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  standing: { fontSize: 11, color: Colors.textMuted },

  centreCol: { paddingHorizontal: 12, alignItems: 'center' },
  predScore:   { fontSize: 20, fontWeight: '800', color: Colors.text },
  resultScore: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  vs:          { fontSize: 14, color: Colors.textMuted, fontWeight: '600' },

  predLabel: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },

  errorText: { color: Colors.destructive, fontSize: 14, marginBottom: 12 },
  retryBtn:  { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: Colors.bg, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
