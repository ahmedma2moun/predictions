import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Colors } from '@/lib/constants';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type RuleBreakdown = {
  key: string; name: string; points: number; awarded: boolean;
};

type Prediction = {
  id: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number;
  scoringBreakdown: RuleBreakdown[] | null;
  match: {
    _id: string; kickoffTime: string; status: string;
    homeTeam: { name: string }; awayTeam: { name: string };
    result?: {
      homeScore: number; awayScore: number;
      penaltyHomeScore?: number | null; penaltyAwayScore?: number | null;
    };
  };
};

type OtherPrediction = {
  userId: string; userName: string;
  homeScore: number; awayScore: number; pointsAwarded: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isLocked(kickoffTime: string): boolean {
  return Date.now() >= new Date(kickoffTime).getTime();
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' · '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Prediction card ────────────────────────────────────────────────────────────

function PredictionCard({ pred }: { pred: Prediction }) {
  const match      = pred.match;
  const locked     = isLocked(match.kickoffTime);
  const isFinished = match.status === 'finished';

  const [expanded,  setExpanded]  = useState(false);
  const [others,    setOthers]    = useState<OtherPrediction[] | null>(null);
  const [loadingOthers, setLoadingOthers] = useState(false);

  async function toggleOthers() {
    if (!expanded && others === null) {
      setLoadingOthers(true);
      try {
        const res = await api.get<{ allPredictions: OtherPrediction[] }>(`/api/mobile/matches/${match._id}`);
        setOthers(res.data.allPredictions ?? []);
      } catch {
        setOthers([]);
      } finally {
        setLoadingOthers(false);
      }
    }
    setExpanded((v) => !v);
  }

  const hasBorder = isFinished && pred.pointsAwarded > 0;

  return (
    <View style={[s.card, hasBorder && s.cardGreen]}>
      {/* Header row */}
      <View style={s.cardHeader}>
        <Text style={s.kickoff}>{formatKickoff(match.kickoffTime)}</Text>
        <View style={s.badges}>
          <View style={[s.badge, s.badgeOutline]}>
            <Text style={s.badgeText}>{match.status.toUpperCase()}</Text>
          </View>
          {isFinished && (
            <View style={[s.badge, pred.pointsAwarded > 0 ? s.badgePrimary : s.badgeSecondary]}>
              <Text style={[s.badgeText, pred.pointsAwarded > 0 && s.badgePrimaryText]}>
                +{pred.pointsAwarded} pts
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Teams + pick grid */}
      <View style={s.grid}>
        <View style={s.gridCol}>
          <Text style={s.gridLabel}>Home</Text>
          <Text style={s.gridTeam} numberOfLines={1}>{match.homeTeam.name}</Text>
        </View>
        <View style={[s.gridCol, { alignItems: 'center' }]}>
          <Text style={s.gridLabel}>Your pick</Text>
          <Text style={s.pickScore}>{pred.homeScore} – {pred.awayScore}</Text>
          {isFinished && match.result && (
            <Text style={s.resultText}>
              Result: {match.result.homeScore}–{match.result.awayScore}
              {match.result.penaltyHomeScore != null
                ? ` (${match.result.penaltyHomeScore}–${match.result.penaltyAwayScore} pen)`
                : ''}
            </Text>
          )}
        </View>
        <View style={[s.gridCol, { alignItems: 'flex-end' }]}>
          <Text style={s.gridLabel}>Away</Text>
          <Text style={s.gridTeam} numberOfLines={1}>{match.awayTeam.name}</Text>
        </View>
      </View>

      {/* Scoring breakdown pills */}
      {isFinished && pred.scoringBreakdown && pred.scoringBreakdown.length > 0 && (
        <View style={s.breakdownRow}>
          {pred.scoringBreakdown.filter(r => r.awarded).map((r) => (
            <View key={r.key} style={s.breakdownPill}>
              <Text style={s.breakdownPillText}>✓ {r.name} (+{r.points})</Text>
            </View>
          ))}
        </View>
      )}

      {/* Show others toggle — only when locked */}
      {locked && (
        <TouchableOpacity style={s.toggleRow} onPress={toggleOthers}>
          {loadingOthers
            ? <ActivityIndicator size="small" color={Colors.textMuted} />
            : <Text style={s.toggleText}>
                {expanded ? '▲ Hide' : '▼ Show'} all predictions
              </Text>}
        </TouchableOpacity>
      )}

      {/* Others list */}
      {expanded && others !== null && (
        <View style={s.othersList}>
          {others.length === 0
            ? <Text style={s.othersEmpty}>No other predictions.</Text>
            : others.map((o) => (
              <View key={o.userId} style={s.otherRow}>
                <Text style={s.otherName} numberOfLines={1}>{o.userName}</Text>
                <Text style={s.otherScore}>{o.homeScore} – {o.awayScore}</Text>
                {isFinished && (
                  <Text style={[s.otherPts, o.pointsAwarded > 0 && s.otherPtsPositive]}>
                    +{o.pointsAwarded} pts
                  </Text>
                )}
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

type Tab = 'upcoming' | 'past';

export default function PicksScreen() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [tab,         setTab]         = useState<Tab>('past');
  const [visiblePast, setVisiblePast] = useState(20);

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await api.get<Prediction[]>('/api/mobile/predictions');
      setPredictions(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load predictions.');
    }
  }, []);

  useEffect(() => {
    fetchPredictions().finally(() => setLoading(false));
  }, [fetchPredictions]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPredictions();
    setRefreshing(false);
  }

  const totalPoints = predictions.reduce((sum, p) => sum + (p.pointsAwarded || 0), 0);

  const upcoming = predictions
    .filter((p) => !isLocked(p.match.kickoffTime))
    .sort((a, b) => new Date(a.match.kickoffTime).getTime() - new Date(b.match.kickoffTime).getTime());

  const past = predictions
    .filter((p) => isLocked(p.match.kickoffTime))
    .sort((a, b) => new Date(b.match.kickoffTime).getTime() - new Date(a.match.kickoffTime).getTime());

  const visiblePastList = past.slice(0, visiblePast);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const currentList = tab === 'upcoming' ? upcoming : visiblePastList;

  return (
    <View style={s.screen}>
      {/* Header with total points */}
      <View style={s.pageHeader}>
        <Text style={s.pageTitle}>My Predictions</Text>
        <View style={s.ptsBadge}>
          <Text style={s.ptsBadgeText}>{totalPoints} pts total</Text>
        </View>
      </View>

      {/* Tab selector */}
      <View style={s.tabs}>
        {(['upcoming', 'past'] as Tab[]).map((t) => {
          const count = t === 'upcoming' ? upcoming.length : past.length;
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, active && s.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>
                {t === 'upcoming' ? 'Upcoming' : 'Past'}
                {count > 0 && ` (${count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {predictions.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No predictions yet. Go predict some matches!</Text>
        </View>
      ) : (
        <SectionList
          sections={[{ key: tab, data: currentList }]}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PredictionCard pred={item} />}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <Text style={[s.emptyText, { paddingHorizontal: 16, paddingTop: 8 }]}>
              {tab === 'upcoming' ? 'No upcoming predictions.' : 'No past predictions yet.'}
            </Text>
          }
          ListFooterComponent={
            tab === 'past' && visiblePast < past.length ? (
              <TouchableOpacity style={s.showMore} onPress={() => setVisiblePast((n) => n + 20)}>
                <Text style={s.showMoreText}>Show more ({past.length - visiblePast} remaining)</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list:   { padding: 12, gap: 10 },

  pageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  ptsBadge:  { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  ptsBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.text },

  tabs: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 4, backgroundColor: Colors.card, borderRadius: 10, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: Colors.bg },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.text },

  // Cards
  card: {
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.cardBorder, padding: 12, gap: 8,
  },
  cardGreen: { borderColor: 'rgba(74,222,128,0.3)' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kickoff:    { fontSize: 11, color: Colors.textMuted },
  badges:     { flexDirection: 'row', gap: 6, alignItems: 'center' },
  badge:      { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  badgeOutline:  { borderWidth: 1, borderColor: Colors.border },
  badgePrimary:  { backgroundColor: Colors.primary },
  badgeSecondary: { backgroundColor: Colors.muted },
  badgeText:     { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  badgePrimaryText: { color: Colors.bg },

  grid:     { flexDirection: 'row', gap: 4 },
  gridCol:  { flex: 1 },
  gridLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 2 },
  gridTeam:  { fontSize: 12, fontWeight: '600', color: Colors.text },
  pickScore: { fontSize: 18, fontWeight: '800', color: Colors.text },
  resultText: { fontSize: 10, color: Colors.textMuted },

  breakdownRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  breakdownPill: { backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  breakdownPillText: { fontSize: 10, color: Colors.primary },

  toggleRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, alignItems: 'center' },
  toggleText: { fontSize: 11, color: Colors.textMuted },

  othersList: { gap: 4 },
  otherRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.muted, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, gap: 8 },
  otherName:  { flex: 1, fontSize: 11, fontWeight: '600', color: Colors.text },
  otherScore: { fontSize: 11, fontWeight: '700', color: Colors.text },
  otherPts:   { fontSize: 11, color: Colors.textMuted, minWidth: 40, textAlign: 'right' },
  otherPtsPositive: { color: Colors.green },
  othersEmpty: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', paddingVertical: 4 },

  emptyText: { fontSize: 13, color: Colors.textMuted },
  showMore:  { alignItems: 'center', paddingVertical: 12 },
  showMoreText: { fontSize: 12, color: Colors.textMuted },
});
