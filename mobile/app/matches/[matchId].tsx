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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest, ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button, Card, Muted, Pill, SectionTitle } from '@/components/ui';
import { H2HRow } from '@/components/H2HRow';
import { StandingsRow } from '@/components/StandingsRow';
import { TeamColumn } from '@/components/TeamColumn';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { GroupPredictionEntry, H2HMatch, LeaderboardGroup, MatchDetail } from '@/types/api';
import { formatKickoff, formatMatchStatus, formatStage, isKnockoutStage, isMatchLocked } from '@/utils/format';

export default function MatchPredictionScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

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
  const [liveScore, setLiveScore] = useState<{ homeScore: number; awayScore: number } | null>(null);

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

      if (data.externalId && isMatchLocked(data.kickoffTime)) {
        apiRequest<{ homeScore: number | null; awayScore: number | null }>(
          `/api/mobile/matches/${matchId}/live`,
          { token },
        )
          .then(live => {
            if (live.homeScore !== null && live.awayScore !== null) {
              setLiveScore({ homeScore: live.homeScore, awayScore: live.awayScore });
            }
          })
          .catch(() => null);
      }

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
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: colors.foreground }}>Match not found</Text>
      </View>
    );
  }

  const locked = isMatchLocked(match.kickoffTime);
  const knockout = isKnockoutStage(match.stage);
  const canPredict = !match.isAdmin && !locked;
  const winnerLabel =
    home > away ? match.homeTeam.name : away > home ? match.awayTeam.name : 'Draw';

  const leagueSuffix = match.leagueName ? ` · ${match.leagueName.toUpperCase()}` : '';
  const matchdayTitle = knockout
    ? `${formatStage(match.stage!)}${match.leg ? ` · Leg ${match.leg}` : ''}${leagueSuffix}`
    : match.matchday
    ? `MD ${match.matchday}${leagueSuffix}`
    : (match.leagueName?.toUpperCase() ?? formatMatchStatus(match.status).toUpperCase());

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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Custom header */}
      <View
        style={[
          styles.customHeader,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: colors.cardElevated, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
          {matchdayTitle}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Hero predict card */}
        <Card style={styles.heroCard}>

          {/* Date + status row */}
          <View style={styles.heroTopRow}>
            <Text style={[styles.heroDate, { color: colors.mutedForeground }]}>
              {formatKickoff(match.kickoffTime).toUpperCase()}
            </Text>
            {match.status === 'live' ? (
              <Pill tone="live">LIVE</Pill>
            ) : locked ? (
              <Pill tone="ghost">LOCKED</Pill>
            ) : (
              <Pill tone="amber" icon={<Ionicons name="time-outline" size={10} color={colors.warning} />}>
                OPEN
              </Pill>
            )}
          </View>

          {/* Teams + steppers */}
          <View style={styles.teamsRow}>
            <TeamColumn
              name={match.homeTeam.name}
              logo={match.homeTeam.logo}
              position={!knockout ? match.homeStanding?.position ?? null : null}
              value={home}
              onChange={setHome}
              disabled={!canPredict}
            />
            <Text style={[styles.dash, { color: colors.mutedForeground, fontFamily: 'JetBrainsMono' }]}>–</Text>
            <TeamColumn
              name={match.awayTeam.name}
              logo={match.awayTeam.logo}
              position={!knockout ? match.awayStanding?.position ?? null : null}
              value={away}
              onChange={setAway}
              disabled={!canPredict}
            />
          </View>

          {/* Outcome label */}
          {canPredict && (
            <Text style={[styles.outcome, { color: colors.mutedForeground }]}>
              Your call:{' '}
              <Text style={{ color: colors.foreground, fontWeight: font.weight.semibold }}>
                {winnerLabel}
              </Text>
            </Text>
          )}

          {/* Live score */}
          {liveScore && (
            <View style={[styles.liveBox, { borderColor: 'rgba(255,77,109,0.30)', backgroundColor: 'rgba(255,77,109,0.08)' }]}>
              <View style={styles.liveLabel}>
                <View style={styles.liveDot} />
                <Text style={[styles.liveLabelText, { color: colors.live }]}>LIVE SCORE</Text>
              </View>
              <Text style={[styles.resultScore, { color: colors.foreground, fontFamily: 'JetBrainsMonoBold' }]}>
                {liveScore.homeScore} – {liveScore.awayScore}
              </Text>
            </View>
          )}

          {/* Result box */}
          {match.result && (
            <View style={[styles.resultBox, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
              <Muted style={{ textAlign: 'center', fontSize: font.size.xs }}>Final Result</Muted>
              <Text style={[styles.resultScore, { color: colors.foreground, fontFamily: 'JetBrainsMonoBold' }]}>
                {match.result.homeScore} – {match.result.awayScore}
              </Text>
              {match.result.penaltyHomeScore != null && (
                <Muted style={{ textAlign: 'center', fontSize: font.size.xs }}>
                  Penalties: {match.result.penaltyHomeScore} – {match.result.penaltyAwayScore}
                </Muted>
              )}
              {!match.isAdmin && !knockout && match.prediction && (
                <Text style={[styles.points, { color: colors.warning }]}>
                  +{match.prediction.pointsAwarded} pts
                </Text>
              )}
            </View>
          )}

          {/* Save button */}
          {canPredict ? (
            <Button
              fullWidth
              onPress={handleSubmit}
              loading={saving}
              style={{ height: 48, marginTop: spacing.sm, borderRadius: radius.md }}
            >
              {match.prediction ? 'Update Prediction' : 'Save Prediction'}
            </Button>
          ) : !match.isAdmin && locked && !match.result ? (
            <Muted style={{ textAlign: 'center', marginTop: spacing.sm }}>
              Predictions are locked for this match
            </Muted>
          ) : null}
        </Card>

        {/* H2H */}
        {h2hLoading && (
          <Card>
            <SectionTitle style={{ marginBottom: spacing.sm }}>Head to Head</SectionTitle>
            <ActivityIndicator color={colors.primary} />
          </Card>
        )}

        {!h2hLoading && h2h && h2h.length > 0 && (() => {
          const summary = computeH2HSummary(h2h, match.homeTeam.name, match.awayTeam.name);
          const total = summary ? summary.homeWins + summary.draws + summary.awayWins : 0;
          return (
            <Card style={{ gap: spacing.md }}>
              <SectionTitle>Head to Head</SectionTitle>
              {summary && (
                <>
                  <View style={styles.h2hSummary}>
                    <View style={styles.h2hSummaryCol}>
                      <Text style={[styles.h2hSummaryNum, { color: colors.foreground, fontFamily: 'JetBrainsMonoBold' }]}>
                        {summary.homeWins}
                      </Text>
                      <Muted style={styles.h2hSummaryLabel} numberOfLines={1}>{match.homeTeam.name}</Muted>
                    </View>
                    <View style={styles.h2hSummaryCol}>
                      <Text style={[styles.h2hSummaryNum, { color: colors.mutedForeground, fontFamily: 'JetBrainsMonoBold' }]}>
                        {summary.draws}
                      </Text>
                      <Muted style={styles.h2hSummaryLabel}>Draw</Muted>
                    </View>
                    <View style={styles.h2hSummaryCol}>
                      <Text style={[styles.h2hSummaryNum, { color: colors.foreground, fontFamily: 'JetBrainsMonoBold' }]}>
                        {summary.awayWins}
                      </Text>
                      <Muted style={styles.h2hSummaryLabel} numberOfLines={1}>{match.awayTeam.name}</Muted>
                    </View>
                  </View>
                  {/* Stacked bar */}
                  {total > 0 && (
                    <View style={[styles.h2hBar, { backgroundColor: colors.cardElevated }]}>
                      {summary.homeWins > 0 && (
                        <View style={[styles.h2hBarFill, { flex: summary.homeWins, backgroundColor: colors.primary }]} />
                      )}
                      {summary.draws > 0 && (
                        <View style={[styles.h2hBarFill, { flex: summary.draws, backgroundColor: colors.mutedForeground + '55' }]} />
                      )}
                      {summary.awayWins > 0 && (
                        <View style={[styles.h2hBarFill, { flex: summary.awayWins, backgroundColor: '#5B8FC9' }]} />
                      )}
                    </View>
                  )}
                </>
              )}
              <View style={{ gap: 0 }}>
                {h2h.map((m, i) => (
                  <View
                    key={`${m.date}:${m.homeTeamName}:${m.awayTeamName}`}
                    style={i > 0 ? [styles.h2hDivider, { borderTopColor: colors.border }] : undefined}
                  >
                    <H2HRow m={m} />
                  </View>
                ))}
              </View>
            </Card>
          );
        })()}

        {/* League standings */}
        {!knockout && (match.homeStanding || match.awayStanding) && (
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>League Standings</SectionTitle>
            <StandingsRow label={match.homeTeam.name} s={match.homeStanding} />
            <StandingsRow label={match.awayTeam.name} s={match.awayStanding} />
          </Card>
        )}

        {/* Group comparison */}
        {(locked || match.isAdmin) && groups.length > 0 && (
          <Card style={{ gap: spacing.sm }}>
            <View style={styles.groupHeader}>
              <SectionTitle>Group Comparison</SectionTitle>
              {groups.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.xs }}
                >
                  {groups.map(g => (
                    <Pressable
                      key={g.id}
                      onPress={() => setSelectedGroupId(g.id)}
                      style={[
                        styles.groupTab,
                        { borderColor: colors.border },
                        selectedGroupId === g.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.groupTabText,
                          { color: colors.mutedForeground },
                          selectedGroupId === g.id && { color: colors.primaryForeground },
                        ]}
                      >
                        {g.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
            {groupPredictionsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
            ) : !groupPredictions || groupPredictions.filter(p => p.predicted).length === 0 ? (
              <Muted style={{ textAlign: 'center', paddingVertical: spacing.md }}>
                No predictions in this group.
              </Muted>
            ) : (
              <View>
                {groupPredictions.filter(p => p.predicted).map((p, i) => (
                  <View
                    key={p.userId}
                    style={[
                      styles.predRow,
                      { borderTopColor: colors.border },
                      i === 0 && { borderTopWidth: 0 },
                    ]}
                  >
                    <Text style={[styles.predName, { color: colors.foreground }]}>{p.userName ?? 'Unknown'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text style={[styles.predScore, { color: colors.foreground, fontFamily: 'JetBrainsMono' }]}>
                        {p.homeScore} – {p.awayScore}
                      </Text>
                      {!knockout && match.result && (
                        <Text style={{ color: (p.pointsAwarded ?? 0) > 0 ? colors.warning : colors.mutedForeground, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>
                          {(p.pointsAwarded ?? 0) > 0 ? `+${p.pointsAwarded}` : '0'}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

      </ScrollView>
    </View>
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
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    customHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11.5,
      fontWeight: font.weight.bold,
      letterSpacing: 0.8,
    },
    content: { padding: spacing.lg, gap: spacing.md },
    heroCard: { padding: 0, overflow: 'hidden' },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      paddingBottom: spacing.md,
    },
    heroDate: { fontSize: font.size.xs, fontWeight: font.weight.semibold, letterSpacing: 0.8 },
    teamsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    dash: { fontSize: font.size.xl, fontWeight: font.weight.bold },
    outcome: { textAlign: 'center', fontSize: font.size.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    liveBox: {
      margin: spacing.lg,
      marginTop: 0,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      alignItems: 'center',
      gap: 4,
    },
    liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4D6D' },
    liveLabelText: { fontSize: 10, fontWeight: font.weight.bold, letterSpacing: 1 },
    resultBox: {
      margin: spacing.lg,
      marginTop: 0,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      alignItems: 'center',
      gap: 2,
    },
    resultScore: {
      fontSize: font.size.xxl,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },
    points: { fontWeight: font.weight.bold, fontSize: font.size.sm, marginTop: 4 },
    h2hSummary: { flexDirection: 'row' },
    h2hSummaryCol: { flex: 1, alignItems: 'center', gap: 2 },
    h2hSummaryNum: { fontSize: font.size.xl, fontWeight: font.weight.bold },
    h2hSummaryLabel: { fontSize: font.size.xs, textAlign: 'center' },
    h2hBar: {
      flexDirection: 'row',
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    h2hBarFill: { height: 6 },
    h2hDivider: { borderTopWidth: StyleSheet.hairlineWidth },
    groupHeader: { gap: spacing.xs },
    groupTab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    groupTabText: { fontSize: font.size.xs, fontWeight: font.weight.medium },
    predRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    predName: { fontSize: font.size.sm, fontWeight: font.weight.medium },
    predScore: { fontSize: font.size.sm, fontVariant: ['tabular-nums'] },
  });
}
