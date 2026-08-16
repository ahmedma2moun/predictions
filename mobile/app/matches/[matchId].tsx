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
import { GroupComparisonCard } from '@/components/GroupComparisonCard';
import { H2HRow } from '@/components/H2HRow';
import { MatchEventRow, mergeMatchEvents } from '@/components/MatchEventRow';
import { StandingsRow } from '@/components/StandingsRow';
import { TeamColumn } from '@/components/TeamColumn';
import { useRemoteData } from '@/hooks/useRemoteData';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { H2HMatch, MatchDetail, MatchEvent } from '@/types/api';
import { formatKickoff, formatMatchStatus, formatStage, isKnockoutStage, isMatchLocked } from '@/utils/format';

export default function MatchPredictionScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [home, setHome]           = useState(0);
  const [away, setAway]           = useState(0);
  const [saving, setSaving]       = useState(false);
  const [liveScore, setLiveScore] = useState<{ homeScore: number; awayScore: number } | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[] | null>(null);

  const loadMatch = useCallback(
    async (signal: AbortSignal) => {
      const [data, h2hData] = await Promise.all([
        apiRequest<MatchDetail>(`/api/mobile/matches/${matchId}`, { token: token!, signal }),
        apiRequest<H2HMatch[]>(`/api/mobile/matches/${matchId}/h2h`, { token: token!, signal }).catch(() => null),
      ]);
      return { match: data, h2h: h2hData };
    },
    [token, matchId],
  );
  const { data, loading, error } = useRemoteData(loadMatch, [token, matchId], { enabled: !!token && !!matchId });
  const match = data?.match ?? null;
  const h2h = data?.h2h ?? null;
  const h2hLoading = loading;

  useEffect(() => {
    if (error) Alert.alert('Failed to load match', error);
  }, [error]);

  useEffect(() => {
    if (match?.prediction) {
      setHome(match.prediction.homeScore);
      setAway(match.prediction.awayScore);
    }
  }, [match?.prediction]);

  useEffect(() => {
    if (!token || !matchId || !match?.externalId || !isMatchLocked(match.kickoffTime)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function fetchLive() {
      try {
        const live = await apiRequest<{ status: string; homeScore: number | null; awayScore: number | null; events: MatchEvent[] }>(
          `/api/mobile/matches/${matchId}/live`,
          { token: token! },
        );
        if (cancelled) return;
        if (live.homeScore !== null && live.awayScore !== null) {
          setLiveScore({ homeScore: live.homeScore, awayScore: live.awayScore });
        }
        if (live.events?.length) setMatchEvents(live.events);
        if (live.status === 'live') {
          timer = setTimeout(fetchLive, 60_000);
        }
      } catch {
        // ignore — live score is best-effort
      }
    }

    fetchLive();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [token, matchId, match?.externalId, match?.kickoffTime]);

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

        {/* Prediction odds — visible to everyone once the match is locked (admins always) */}
        {(locked || match.isAdmin) && match.odds && (() => {
          const votes = match.odds.votes ?? { homeWin: 0, draw: 0, awayWin: 0 };
          const totalVotes = votes.homeWin + votes.draw + votes.awayWin;
          const cells = [
            { label: match.homeTeam.name, odds: match.odds.homeWin, count: votes.homeWin },
            { label: 'Draw',              odds: match.odds.draw,    count: votes.draw },
            { label: match.awayTeam.name, odds: match.odds.awayWin, count: votes.awayWin },
          ];
          return (
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.oddsHeader}>
                <SectionTitle>Prediction Odds</SectionTitle>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {match.odds.locked && (
                    <Ionicons name="lock-closed" size={11} color={colors.mutedForeground} />
                  )}
                  <Muted style={{ fontSize: font.size.xs }}>
                    {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                  </Muted>
                </View>
              </View>
              <View style={styles.oddsRow}>
                {cells.map(({ label, odds, count }) => {
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : null;
                  return (
                    <View
                      key={label}
                      style={[styles.oddsCell, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}
                    >
                      <Muted style={styles.oddsCellLabel} numberOfLines={1}>{label}</Muted>
                      <Text style={[styles.oddsCellValue, { color: colors.foreground, fontFamily: 'JetBrainsMonoBold' }]}>
                        {odds.toFixed(2)}
                      </Text>
                      <Muted style={styles.oddsCellLabel}>
                        {pct !== null ? `${pct}%` : '—'} · {count}v
                      </Muted>
                    </View>
                  );
                })}
              </View>
            </Card>
          );
        })()}

        {/* Match events */}
        {matchEvents && matchEvents.length > 0 && (
          <Card style={{ gap: spacing.xs }}>
            <SectionTitle>Match Events</SectionTitle>
            <View>
              {mergeMatchEvents(matchEvents).map((e, i) => (
                <MatchEventRow key={i} event={e} />
              ))}
            </View>
          </Card>
        )}

        {/* H2H */}
        {h2hLoading && (
          <Card>
            <SectionTitle style={{ marginBottom: spacing.sm }}>Head to Head</SectionTitle>
            <ActivityIndicator color={colors.primary} />
          </Card>
        )}

        {!h2hLoading && h2h && h2h.length > 0 && (() => {
          const summary = computeH2HSummary(h2h, match.homeTeam.name);
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
        <GroupComparisonCard
          matchId={String(matchId)}
          isAdmin={match.isAdmin}
          locked={locked}
          hasResult={!!match.result}
          isKnockout={knockout}
          liveScore={liveScore}
        />

      </ScrollView>
    </View>
  );
}

function teamsMatch(h2hName: string, upcomingName: string): boolean {
  const a = h2hName.toLowerCase().trim();
  const b = upcomingName.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

function computeH2HSummary(h2h: import('@/types/api').H2HMatch[], homeTeamName: string) {
  const done = h2h.filter(m => m.homeScore !== null && m.awayScore !== null);
  if (done.length === 0) return null;
  let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0;
  for (const m of done) {
    const hs = m.homeScore!, as = m.awayScore!;
    totalGoals += hs + as;
    const leftIsHome = teamsMatch(m.homeTeamName, homeTeamName);
    if (hs > as) {
      if (leftIsHome) homeWins++; else awayWins++;
    } else if (as > hs) {
      if (leftIsHome) awayWins++; else homeWins++;
    } else {
      draws++;
    }
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
    oddsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    oddsRow: { flexDirection: 'row', gap: spacing.sm },
    oddsCell: {
      flex: 1,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      gap: 2,
    },
    oddsCellLabel: { fontSize: 10, textAlign: 'center' },
    oddsCellValue: {
      fontSize: font.size.md,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },
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
  });
}
