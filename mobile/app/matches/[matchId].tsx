import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiRequest, ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Button, Card, Muted } from '@/components/ui';
import { H2HRow } from '@/components/H2HRow';
import { StandingsRow } from '@/components/StandingsRow';
import { TeamColumn } from '@/components/TeamColumn';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { GroupPredictionEntry, H2HMatch, LeaderboardGroup, MatchDetail } from '@/types/api';
import { formatKickoff, formatStage, isKnockoutStage, isMatchLocked } from '@/utils/format';

export default function MatchPredictionScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [match, setMatch]         = useState<MatchDetail | null>(null);
  const [home, setHome]           = useState(0);
  const [away, setAway]           = useState(0);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [h2h, setH2h]             = useState<H2HMatch[] | null>(null);
  const [h2hLoading, setH2hLoading] = useState(true);
  const [groups, setGroups]       = useState<LeaderboardGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupPredictions, setGroupPredictions] = useState<GroupPredictionEntry[] | null>(null);
  const [groupPredictionsLoading, setGroupPredictionsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || !matchId) return;
    setH2hLoading(true);
    try {
      const [data, h2hData, groupsData] = await Promise.all([
        apiRequest<MatchDetail>(`/api/mobile/matches/${matchId}`, { token }),
        apiRequest<H2HMatch[]>(`/api/mobile/matches/${matchId}/h2h`, { token }).catch(() => null),
        apiRequest<LeaderboardGroup[]>(`/api/mobile/groups`, { token }).catch(() => []),
      ]);
      setMatch(data);
      if (data.prediction) {
        setHome(data.prediction.homeScore);
        setAway(data.prediction.awayScore);
      }
      setH2h(h2hData);
      setGroups(groupsData ?? []);
      if (groupsData && groupsData.length > 0) setSelectedGroupId(groupsData[0].id);
    } catch (e: any) {
      Alert.alert('Failed to load match', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
      setH2hLoading(false);
    }
  }, [token, matchId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token || !matchId || !selectedGroupId || !match) return;
    const locked = isMatchLocked(match.kickoffTime);
    if (!locked && !match.isAdmin) return;
    setGroupPredictionsLoading(true);
    setGroupPredictions(null);
    apiRequest<GroupPredictionEntry[]>(
      `/api/mobile/matches/${matchId}/group-predictions?groupId=${selectedGroupId}`,
      { token },
    )
      .then(data => setGroupPredictions(data))
      .catch(() => setGroupPredictions(null))
      .finally(() => setGroupPredictionsLoading(false));
  }, [token, matchId, selectedGroupId, match]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.foreground }}>Match not found</Text>
      </View>
    );
  }

  const locked = isMatchLocked(match.kickoffTime);
  const knockout = isKnockoutStage(match.stage);
  const canPredict = !match.isAdmin && !locked;
  const winnerLabel =
    home > away ? match.homeTeam.name : away > home ? match.awayTeam.name : 'Draw';

  async function handleSubmit() {
    if (!token || !match) return;
    setSaving(true);
    try {
      await apiRequest('/api/mobile/predictions', {
        method: 'POST',
        body: { matchId: match._id, homeScore: home, awayScore: away },
        token,
      });
      Alert.alert('Prediction saved');
      router.back();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to save prediction';
      Alert.alert('Save failed', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{match.isAdmin ? 'Match Details' : 'Predict Score'}</Text>
          <Badge
            variant={match.status === 'live' ? 'destructive' : locked ? 'secondary' : 'outline'}
            icon={locked ? <Ionicons name="lock-closed" size={11} color={colors.foreground} /> : undefined}
          >
            {locked ? 'Locked' : match.status.toUpperCase()}
          </Badge>
        </View>
        <Muted>{formatKickoff(match.kickoffTime)}</Muted>
        {knockout ? (
          <Muted style={{ fontSize: font.size.xs, marginTop: 2 }}>
            {formatStage(match.stage!)}{match.leg ? ` · Leg ${match.leg}` : ''}
          </Muted>
        ) : match.matchday ? (
          <Muted style={{ fontSize: font.size.xs, marginTop: 2 }}>Matchday {match.matchday}</Muted>
        ) : null}
        {match.venue && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
            <Muted style={{ fontSize: font.size.xs }}>{match.venue}</Muted>
          </View>
        )}

        <View style={styles.teamsRow}>
          <TeamColumn
            name={match.homeTeam.name}
            logo={match.homeTeam.logo}
            position={!knockout ? match.homeStanding?.position ?? null : null}
            value={home}
            onChange={setHome}
            disabled={!canPredict}
          />
          <Text style={styles.dash}>–</Text>
          <TeamColumn
            name={match.awayTeam.name}
            logo={match.awayTeam.logo}
            position={!knockout ? match.awayStanding?.position ?? null : null}
            value={away}
            onChange={setAway}
            disabled={!canPredict}
          />
        </View>

        {canPredict && (
          <Text style={styles.outcome}>
            Predicted outcome: <Text style={styles.outcomeStrong}>{winnerLabel}</Text>
          </Text>
        )}

        {match.result && (
          <View style={styles.resultBox}>
            <Muted style={{ textAlign: 'center', fontSize: font.size.xs }}>Final Result</Muted>
            <Text style={styles.resultScore}>
              {match.result.homeScore} – {match.result.awayScore}
            </Text>
            {match.result.penaltyHomeScore != null && (
              <Muted style={{ textAlign: 'center', fontSize: font.size.xs }}>
                Penalties: {match.result.penaltyHomeScore} – {match.result.penaltyAwayScore}
              </Muted>
            )}
            {!match.isAdmin && !knockout && match.prediction && (
              <Text style={styles.points}>+{match.prediction.pointsAwarded} pts</Text>
            )}
          </View>
        )}

        {canPredict ? (
          <Button fullWidth onPress={handleSubmit} loading={saving}>
            {match.prediction ? 'Update Prediction' : 'Save Prediction'}
          </Button>
        ) : !match.isAdmin && locked ? (
          <Muted style={{ textAlign: 'center', marginTop: spacing.sm }}>
            Predictions are locked for this match
          </Muted>
        ) : null}
      </Card>

      {h2hLoading && (
        <Card>
          <Text style={styles.sectionTitle}>Head to Head</Text>
          <ActivityIndicator color={colors.primary} />
        </Card>
      )}

      {!h2hLoading && h2h && h2h.length > 0 && (() => {
        const summary = computeH2HSummary(h2h, match.homeTeam.name, match.awayTeam.name);
        return (
          <Card>
            <Text style={styles.sectionTitle}>Head to Head</Text>
            <Muted style={{ fontSize: font.size.xs, marginBottom: spacing.sm }}>
              Last {h2h.length} meeting{h2h.length !== 1 ? 's' : ''}
            </Muted>
            {summary && (
              <View style={styles.h2hSummary}>
                <View style={styles.h2hSummaryCol}>
                  <Text style={styles.h2hSummaryNum}>{summary.homeWins}</Text>
                  <Muted style={styles.h2hSummaryLabel} numberOfLines={1}>{match.homeTeam.name}</Muted>
                </View>
                <View style={styles.h2hSummaryCol}>
                  <Text style={styles.h2hSummaryNum}>{summary.draws}</Text>
                  <Muted style={styles.h2hSummaryLabel}>Draw</Muted>
                </View>
                <View style={styles.h2hSummaryCol}>
                  <Text style={styles.h2hSummaryNum}>{summary.awayWins}</Text>
                  <Muted style={styles.h2hSummaryLabel} numberOfLines={1}>{match.awayTeam.name}</Muted>
                </View>
              </View>
            )}
            {summary && (
              <View style={styles.h2hSummaryStats}>
                <Muted style={{ fontSize: font.size.xs }}>Avg {summary.avgGoals} goals/game</Muted>
                <Muted style={{ fontSize: font.size.xs }}>Last: {summary.last.homeScore} – {summary.last.awayScore}</Muted>
              </View>
            )}
            {h2h.map(m => (
              <H2HRow key={`${m.date}:${m.homeTeamName}:${m.awayTeamName}`} m={m} />
            ))}
          </Card>
        );
      })()}

      {!knockout && (match.homeStanding || match.awayStanding) && (
        <Card>
          <Text style={styles.sectionTitle}>League Standings</Text>
          <StandingsRow label={match.homeTeam.name} s={match.homeStanding} />
          <StandingsRow label={match.awayTeam.name} s={match.awayStanding} />
        </Card>
      )}

      {(locked || match.isAdmin) && groups.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>Group Comparison</Text>
          {groups.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: spacing.sm }}
              contentContainerStyle={{ gap: spacing.xs }}
            >
              {groups.map(g => (
                <Pressable
                  key={g.id}
                  onPress={() => setSelectedGroupId(g.id)}
                  style={[
                    styles.groupTab,
                    selectedGroupId === g.id && styles.groupTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.groupTabText,
                      selectedGroupId === g.id && styles.groupTabTextActive,
                    ]}
                  >
                    {g.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {groupPredictionsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
          ) : !groupPredictions || groupPredictions.length === 0 ? (
            <Muted style={{ textAlign: 'center', paddingVertical: spacing.md }}>
              No predictions in this group.
            </Muted>
          ) : (
            groupPredictions.map(p => (
              <View key={p.userId} style={styles.predRow}>
                <Text style={styles.predName}>{p.userName ?? 'Unknown'}</Text>
                {p.predicted ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={styles.predScore}>{p.homeScore} – {p.awayScore}</Text>
                    {!knockout && match.result && (
                      <Text style={(p.pointsAwarded ?? 0) > 0 ? styles.points : styles.zeroPoints}>
                        {(p.pointsAwarded ?? 0) > 0 ? `+${p.pointsAwarded} pts` : '0 pts'}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Muted style={{ fontSize: font.size.xs, fontStyle: 'italic' }}>No prediction</Muted>
                )}
              </View>
            ))
          )}
        </Card>
      )}

      {(locked || match.isAdmin) && match.allPredictions && (
        <Card>
          <Text style={styles.sectionTitle}>All Predictions</Text>
          {match.allPredictions.length === 0 ? (
            <Muted style={{ textAlign: 'center', paddingVertical: spacing.md }}>
              No predictions submitted.
            </Muted>
          ) : (
            match.allPredictions.map(p => (
              <View key={p.userId} style={styles.predRow}>
                <Text style={styles.predName}>{p.userName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={styles.predScore}>{p.homeScore} – {p.awayScore}</Text>
                  {!knockout && match.result && (
                    <Text style={p.pointsAwarded > 0 ? styles.points : styles.zeroPoints}>
                      {p.pointsAwarded > 0 ? `+${p.pointsAwarded} pts` : '0 pts'}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </Card>
      )}
    </ScrollView>
  );
}

function teamsMatch(h2hName: string, upcomingName: string): boolean {
  const a = h2hName.toLowerCase().trim();
  const b = upcomingName.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

function computeH2HSummary(h2h: import('@/types/api').H2HMatch[], homeTeamName: string, awayTeamName: string) {
  const done = h2h.filter(m => m.homeScore !== null && m.awayScore !== null);
  if (done.length === 0) return null;
  let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0;
  for (const m of done) {
    const hs = m.homeScore!, as = m.awayScore!;
    totalGoals += hs + as;
    const leftIsHome = teamsMatch(m.homeTeamName, homeTeamName);
    if (hs > as)      leftIsHome ? homeWins++ : awayWins++;
    else if (as > hs) leftIsHome ? awayWins++ : homeWins++;
    else              draws++;
  }
  const last = done[0];
  return {
    homeWins, draws, awayWins,
    avgGoals: Math.round((totalGoals / done.length) * 10) / 10,
    last: { homeScore: last.homeScore!, awayScore: last.awayScore! },
  };
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    title: { color: c.foreground, fontSize: font.size.lg, fontWeight: font.weight.bold },
    teamsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
    dash: { color: c.mutedForeground, fontSize: font.size.xl, fontWeight: font.weight.bold },
    outcome: { textAlign: 'center', color: c.mutedForeground, fontSize: font.size.sm, marginTop: spacing.md },
    outcomeStrong: { color: c.foreground, fontWeight: font.weight.medium },
    resultBox: {
      marginTop: spacing.md,
      backgroundColor: c.accent,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      gap: 2,
    },
    resultScore: {
      color: c.foreground,
      fontSize: font.size.xxl,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },
    points: { color: c.warning, fontWeight: font.weight.bold, fontSize: font.size.sm, marginTop: 4 },
    zeroPoints: { color: c.mutedForeground, fontSize: font.size.sm },
    sectionTitle: {
      color: c.foreground,
      fontSize: font.size.md,
      fontWeight: font.weight.semibold,
      marginBottom: spacing.sm,
    },
    predRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    predName: { color: c.foreground, fontSize: font.size.sm, fontWeight: font.weight.medium },
    predScore: { color: c.foreground, fontSize: font.size.sm, fontVariant: ['tabular-nums'] },
    groupTab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
    },
    groupTabActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    groupTabText: { color: c.mutedForeground, fontSize: font.size.xs, fontWeight: font.weight.medium },
    groupTabTextActive: { color: c.primaryForeground },
    h2hSummary: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    h2hSummaryCol: { flex: 1, alignItems: 'center' },
    h2hSummaryNum: {
      color: c.foreground,
      fontSize: font.size.lg,
      fontWeight: font.weight.bold,
    },
    h2hSummaryLabel: { fontSize: font.size.xs, textAlign: 'center' },
    h2hSummaryStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing.xs,
      marginBottom: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
  });
}
