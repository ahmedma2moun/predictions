import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiRequest, ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Button, Card, Muted } from '@/components/ui';
import { colors, font, radius, spacing } from '@/theme/colors';
import type { H2HMatch, MatchDetail } from '@/types/api';
import { formatKickoff, formatStage, isKnockoutStage, isMatchLocked, ordinal } from '@/utils/format';

export default function MatchPredictionScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [h2h, setH2h] = useState<H2HMatch[] | null>(null);
  const [h2hLoading, setH2hLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !matchId) return;
    setH2hLoading(true);
    try {
      const [data, h2hData] = await Promise.all([
        apiRequest<MatchDetail>(`/api/mobile/matches/${matchId}`, { token }),
        apiRequest<H2HMatch[]>(`/api/mobile/matches/${matchId}/h2h`, { token }).catch(() => null),
      ]);
      setMatch(data);
      if (data.prediction) {
        setHome(data.prediction.homeScore);
        setAway(data.prediction.awayScore);
      }
      setH2h(h2hData);
    } catch (e: any) {
      Alert.alert('Failed to load match', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
      setH2hLoading(false);
    }
  }, [token, matchId]);

  useEffect(() => { load(); }, [load]);

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
          <Muted style={{ fontSize: font.size.xs, marginTop: 2 }}>
            Matchday {match.matchday}
          </Muted>
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

      {!h2hLoading && h2h && h2h.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>Head to Head</Text>
          <Muted style={{ fontSize: font.size.xs, marginBottom: spacing.sm }}>
            Last {h2h.length} meeting{h2h.length !== 1 ? 's' : ''}
          </Muted>
          {h2h.map((m, i) => <H2HRow key={i} m={m} />)}
        </Card>
      )}

      {!knockout && (match.homeStanding || match.awayStanding) && (
        <Card>
          <Text style={styles.sectionTitle}>League Standings</Text>
          <StandingsRow label={match.homeTeam.name} s={match.homeStanding} />
          <StandingsRow label={match.awayTeam.name} s={match.awayStanding} />
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
                  <Text style={styles.predScore}>
                    {p.homeScore} – {p.awayScore}
                  </Text>
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

function TeamColumn({
  name,
  logo,
  position,
  value,
  onChange,
  disabled,
}: {
  name: string;
  logo: string | null;
  position: number | null;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.teamCol}>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.teamLogo} resizeMode="contain" />
      ) : (
        <View style={[styles.teamLogo, { backgroundColor: colors.accent, borderRadius: radius.md }]} />
      )}
      <Text style={styles.teamName} numberOfLines={2}>{name}</Text>
      {position && <Muted style={{ fontSize: font.size.xs }}>{ordinal(position)}</Muted>}
      <View style={styles.scoreRow}>
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value <= 0}
          style={({ pressed }) => [
            styles.scoreBtn,
            (disabled || value <= 0) && styles.scoreBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="remove" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={styles.scoreValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.scoreBtn,
            disabled && styles.scoreBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function formatH2HDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit',
  });
}

function H2HRow({ m }: { m: H2HMatch }) {
  const winner =
    m.homeScore !== null && m.awayScore !== null
      ? m.homeScore > m.awayScore ? 'home'
        : m.awayScore > m.homeScore ? 'away'
        : 'draw'
      : null;
  const homeStrong = winner === 'home';
  const awayStrong = winner === 'away';
  const homeDim = winner !== null && winner !== 'draw' && winner !== 'home';
  const awayDim = winner !== null && winner !== 'draw' && winner !== 'away';

  return (
    <View style={styles.h2hRow}>
      <View style={styles.h2hMeta}>
        <Muted style={{ fontSize: font.size.xs }}>{formatH2HDate(m.date)}</Muted>
        <Muted style={{ fontSize: font.size.xs, maxWidth: 140 }} numberOfLines={1}>{m.competition}</Muted>
      </View>
      <View style={styles.h2hTeams}>
        <View style={styles.h2hTeamLeft}>
          {m.homeTeamLogo && <Image source={{ uri: m.homeTeamLogo }} style={styles.h2hLogo} resizeMode="contain" />}
          <Text
            numberOfLines={1}
            style={[
              styles.h2hTeamName,
              homeStrong && { fontWeight: font.weight.semibold },
              homeDim && { color: colors.mutedForeground },
            ]}
          >
            {m.homeTeamName}
          </Text>
        </View>
        <View style={styles.h2hScoreBox}>
          <Text style={styles.h2hScore}>
            {m.homeScore ?? '–'} – {m.awayScore ?? '–'}
          </Text>
          {m.penaltyHomeScore != null && (
            <Muted style={{ fontSize: 10, textAlign: 'center' }}>
              ({m.penaltyHomeScore} – {m.penaltyAwayScore} pen)
            </Muted>
          )}
        </View>
        <View style={styles.h2hTeamRight}>
          <Text
            numberOfLines={1}
            style={[
              styles.h2hTeamName,
              { textAlign: 'right' },
              awayStrong && { fontWeight: font.weight.semibold },
              awayDim && { color: colors.mutedForeground },
            ]}
          >
            {m.awayTeamName}
          </Text>
          {m.awayTeamLogo && <Image source={{ uri: m.awayTeamLogo }} style={styles.h2hLogo} resizeMode="contain" />}
        </View>
      </View>
    </View>
  );
}

function StandingsRow({ label, s }: { label: string; s: MatchDetail['homeStanding'] }) {
  if (!s) return null;
  const form = (s.form ?? '').slice(-5).split('');
  return (
    <View style={styles.standingsRow}>
      <Text style={styles.standingLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.standingCol}>{ordinal(s.position)}</Text>
      <Text style={styles.standingCol}>
        {s.won ?? 0}W {s.drawn ?? 0}D {s.lost ?? 0}L
      </Text>
      <Text style={styles.standingPts}>{s.points} pts</Text>
      <View style={styles.formRow}>
        {form.map((c, i) => (
          <View
            key={i}
            style={[
              styles.formDot,
              { backgroundColor: c === 'W' ? colors.success : c === 'D' ? colors.warning : colors.destructive },
            ]}
          >
            <Text style={styles.formText}>{c}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.foreground,
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  dash: { color: colors.mutedForeground, fontSize: font.size.xl, fontWeight: font.weight.bold },
  teamCol: { flex: 1, alignItems: 'center', gap: spacing.sm },
  teamLogo: { width: 56, height: 56 },
  teamName: {
    color: colors.foreground,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    textAlign: 'center',
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  scoreBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
  },
  scoreBtnDisabled: { opacity: 0.4 },
  scoreValue: {
    color: colors.foreground,
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    fontVariant: ['tabular-nums'],
    width: 40,
    textAlign: 'center',
  },
  outcome: {
    textAlign: 'center',
    color: colors.mutedForeground,
    fontSize: font.size.sm,
    marginTop: spacing.md,
  },
  outcomeStrong: { color: colors.foreground, fontWeight: font.weight.medium },
  resultBox: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  resultScore: {
    color: colors.foreground,
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  points: { color: colors.warning, fontWeight: font.weight.bold, fontSize: font.size.sm, marginTop: 4 },
  zeroPoints: { color: colors.mutedForeground, fontSize: font.size.sm },
  sectionTitle: {
    color: colors.foreground,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    marginBottom: spacing.sm,
  },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  standingLabel: { flex: 1, color: colors.mutedForeground, fontSize: font.size.xs },
  standingCol: { color: colors.foreground, fontSize: font.size.xs, minWidth: 56, textAlign: 'center' },
  standingPts: { color: colors.foreground, fontSize: font.size.sm, fontWeight: font.weight.semibold, minWidth: 48, textAlign: 'center' },
  formRow: { flexDirection: 'row', gap: 2 },
  formDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  formText: { color: '#fff', fontSize: 9, fontWeight: font.weight.bold },
  predRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  predName: { color: colors.foreground, fontSize: font.size.sm, fontWeight: font.weight.medium },
  predScore: {
    color: colors.foreground,
    fontSize: font.size.sm,
    fontVariant: ['tabular-nums'],
  },
  h2hRow: {
    gap: 4,
    paddingVertical: spacing.xs,
  },
  h2hMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  h2hTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  h2hTeamLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  h2hTeamRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    minWidth: 0,
  },
  h2hLogo: { width: 16, height: 16 },
  h2hTeamName: {
    color: colors.foreground,
    fontSize: font.size.sm,
    flexShrink: 1,
  },
  h2hScoreBox: { width: 64, alignItems: 'center' },
  h2hScore: {
    color: colors.foreground,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    fontVariant: ['tabular-nums'],
  },
});
