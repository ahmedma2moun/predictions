import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/lib/constants';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type Standing = {
  position: number; played: number; won: number; drawn: number;
  lost: number; points: number; goalDifference: number; form: string | null;
} | null;

type PredEntry = {
  userId: string; userName: string;
  homeScore: number; awayScore: number;
  pointsAwarded: number;
  scoringBreakdown: { key: string; name: string; points: number; awarded: boolean }[] | null;
};

type H2HMatch = {
  date: string;
  homeTeam: { name: string; logo: string };
  awayTeam: { name: string; logo: string };
  homeScore: number | null; awayScore: number | null;
  penaltyHomeScore: number | null; penaltyAwayScore: number | null;
  competition: string; status: string;
};

type MatchDetail = {
  _id: string; kickoffTime: string; status: string;
  stage: string | null; leg: number | null; matchday: number | null;
  venue: string | null; leagueName: string | null;
  homeTeam: { name: string; logo?: string | null };
  awayTeam: { name: string; logo?: string | null };
  result: { homeScore: number; awayScore: number } | null;
  resultPenaltyHomeScore: number | null; resultPenaltyAwayScore: number | null;
  homeStanding: Standing; awayStanding: Standing;
  prediction: { homeScore: number; awayScore: number; pointsAwarded: number } | null;
  allPredictions: PredEntry[] | null;
  isAdmin: boolean; isKnockout: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isLocked(kickoffTime: string): boolean {
  return Date.now() >= new Date(kickoffTime).getTime();
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    + ' · '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatH2HDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatStage(stage: string, leg: number | null): string {
  const map: Record<string, string> = {
    LAST_16: 'Round of 16', ROUND_OF_16: 'Round of 16',
    QUARTER_FINALS: 'Quarter Finals', SEMI_FINALS: 'Semi Finals',
    FINAL: 'Final', THIRD_PLACE: '3rd Place',
  };
  const label = map[stage] ?? stage.replace(/_/g, ' ');
  return leg ? `${label} · Leg ${leg}` : label;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <View style={si.row}>
      <TouchableOpacity
        style={[si.btn, (disabled || value <= 0) && si.btnDisabled]}
        onPress={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
      >
        <Ionicons name="remove" size={20} color={disabled ? Colors.textDim : Colors.text} />
      </TouchableOpacity>
      <Text style={si.value}>{value}</Text>
      <TouchableOpacity
        style={[si.btn, disabled && si.btnDisabled]}
        onPress={() => onChange(value + 1)}
        disabled={disabled}
      >
        <Ionicons name="add" size={20} color={disabled ? Colors.textDim : Colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const si = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 14 },
  btn:        { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { borderColor: Colors.textDim, opacity: 0.4 },
  value:      { fontSize: 32, fontWeight: '800', color: Colors.text, minWidth: 36, textAlign: 'center' },
});

function FormBadge({ char }: { char: string }) {
  const color = char === 'W' ? Colors.green : char === 'D' ? Colors.yellow : Colors.red;
  return (
    <View style={[fb.dot, { backgroundColor: color }]}>
      <Text style={fb.char}>{char}</Text>
    </View>
  );
}
const fb = StyleSheet.create({
  dot:  { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  char: { color: '#fff', fontSize: 9, fontWeight: '800' },
});

function StandingsRow({ label, s }: { label: string; s: Standing }) {
  if (!s) return null;
  const form = s.form ? s.form.split('').slice(-5) : [];
  return (
    <View style={str.row}>
      <Text style={str.label} numberOfLines={1}>{label}</Text>
      <Text style={str.pos}>{ordinal(s.position)}</Text>
      <Text style={str.record}>{s.won}W {s.drawn}D {s.lost}L</Text>
      <Text style={str.pts}>{s.points} pts</Text>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {form.map((c, i) => <FormBadge key={i} char={c} />)}
      </View>
    </View>
  );
}
const str = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  label:  { width: 80, fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  pos:    { width: 30, fontSize: 12, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  record: { width: 72, fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  pts:    { width: 44, fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
});

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  const [match,   setMatch]   = useState<MatchDetail | null>(null);
  const [h2h,     setH2h]     = useState<H2HMatch[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [locked,  setLocked]  = useState(false);

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);

  const [editingResult, setEditingResult] = useState(false);
  const [editHome,      setEditHome]      = useState(0);
  const [editAway,      setEditAway]      = useState(0);
  const [savingResult,  setSavingResult]  = useState(false);

  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMatch = useCallback(async () => {
    try {
      const [matchRes, h2hRes] = await Promise.all([
        api.get<MatchDetail>(`/api/mobile/matches/${matchId}`),
        api.get<{ matches: H2HMatch[] }>(`/api/mobile/matches/${matchId}/h2h`).catch(() => ({ data: { matches: null } })),
      ]);
      const m = matchRes.data;
      setMatch(m);
      setH2h(h2hRes.data.matches ?? null);
      setLocked(isLocked(m.kickoffTime));
      if (m.prediction) {
        setHomeScore(m.prediction.homeScore);
        setAwayScore(m.prediction.awayScore);
      }
    } catch {
      // handled by null match state
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { loadMatch(); }, [loadMatch]);

  // Auto-lock at kickoff if the screen stays open
  useEffect(() => {
    if (!match || locked) return;
    const ms = new Date(match.kickoffTime).getTime() - Date.now();
    if (ms <= 0) { setLocked(true); return; }
    lockTimer.current = setTimeout(() => setLocked(true), ms);
    return () => { if (lockTimer.current) clearTimeout(lockTimer.current); };
  }, [match, locked]);

  async function handleSaveResult() {
    if (!match) return;
    setSavingResult(true);
    try {
      const res = await api.patch<{ emailsSent: number; predictions: PredEntry[] }>(
        `/api/mobile/matches/${match._id}`,
        { homeScore: editHome, awayScore: editAway },
      );
      setMatch(prev => prev ? {
        ...prev,
        result: { homeScore: editHome, awayScore: editAway },
        allPredictions: res.data.predictions,
      } : prev);
      Alert.alert(
        'Result Updated',
        `${res.data.emailsSent} correction email${res.data.emailsSent !== 1 ? 's' : ''} sent to users.`,
      );
      setEditingResult(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to update result.';
      Alert.alert('Error', msg);
    } finally {
      setSavingResult(false);
    }
  }

  async function handleSave() {
    if (!match || locked || match.isAdmin) return;
    setSaving(true);
    try {
      await api.post('/api/mobile/predictions', {
        matchId: match._id,
        homeScore,
        awayScore,
      });
      Alert.alert('Saved!', 'Your prediction has been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to save prediction.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Match not found.</Text>
      </View>
    );
  }

  const hasStandings = !match.isKnockout && (match.homeStanding !== null || match.awayStanding !== null);
  const predictedOutcome = homeScore > awayScore
    ? match.homeTeam.name
    : awayScore > homeScore
    ? match.awayTeam.name
    : 'Draw';

  return (
    <>
      <Stack.Screen options={{ title: `${match.homeTeam.name} vs ${match.awayTeam.name}` }} />
      <ScrollView style={s.screen} contentContainerStyle={s.content}>

        {/* ── Main card ── */}
        <View style={s.card}>
          {/* Status + time */}
          <View style={s.cardHeader}>
            <View>
              <Text style={s.kickoffText}>{formatKickoff(match.kickoffTime)}</Text>
              {match.isKnockout && match.stage ? (
                <Text style={s.stageText}>{formatStage(match.stage, match.leg)}</Text>
              ) : match.matchday ? (
                <Text style={s.stageText}>Matchday {match.matchday}</Text>
              ) : null}
              {match.venue ? (
                <Text style={s.venueText}>📍 {match.venue}</Text>
              ) : null}
            </View>
            <View style={[
              s.statusBadge,
              match.status === 'live' && s.statusLive,
              locked && !['live'].includes(match.status) && s.statusLocked,
            ]}>
              {locked && match.status !== 'live'
                ? <><Ionicons name="lock-closed" size={10} color={Colors.textMuted} /><Text style={s.statusBadgeText}> Locked</Text></>
                : <Text style={s.statusBadgeText}>{match.status.toUpperCase()}</Text>}
            </View>
          </View>

          {/* Teams + score inputs */}
          <View style={s.teamsContainer}>
            {/* Home */}
            <View style={s.teamBlock}>
              {match.homeTeam.logo
                ? <Image source={{ uri: match.homeTeam.logo }} style={s.teamLogo} resizeMode="contain" />
                : <View style={s.teamLogoPlaceholder} />}
              <Text style={s.teamName} numberOfLines={2}>{match.homeTeam.name}</Text>
              {!match.isKnockout && match.homeStanding && (
                <Text style={s.teamPos}>{ordinal(match.homeStanding.position)}</Text>
              )}
              {!match.isAdmin && (
                <ScoreInput value={homeScore} onChange={setHomeScore} disabled={locked} />
              )}
            </View>

            <View style={s.vsDivider}>
              <Text style={s.vsText}>–</Text>
            </View>

            {/* Away */}
            <View style={s.teamBlock}>
              {match.awayTeam.logo
                ? <Image source={{ uri: match.awayTeam.logo }} style={s.teamLogo} resizeMode="contain" />
                : <View style={s.teamLogoPlaceholder} />}
              <Text style={s.teamName} numberOfLines={2}>{match.awayTeam.name}</Text>
              {!match.isKnockout && match.awayStanding && (
                <Text style={s.teamPos}>{ordinal(match.awayStanding.position)}</Text>
              )}
              {!match.isAdmin && (
                <ScoreInput value={awayScore} onChange={setAwayScore} disabled={locked} />
              )}
            </View>
          </View>

          {/* Outcome hint */}
          {!match.isAdmin && !locked && (
            <Text style={s.outcomeHint}>
              Predicted outcome: <Text style={{ color: Colors.text, fontWeight: '600' }}>{predictedOutcome}</Text>
            </Text>
          )}

          {/* Final result */}
          {match.result && (
            <View style={s.resultBox}>
              <View style={s.resultHeader}>
                <Text style={s.resultLabel}>Final Result</Text>
                {match.isAdmin && !editingResult && (
                  <TouchableOpacity
                    onPress={() => { setEditHome(match.result!.homeScore); setEditAway(match.result!.awayScore); setEditingResult(true); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {editingResult ? (
                <View style={s.editResultRow}>
                  <ScoreInput value={editHome} onChange={setEditHome} disabled={savingResult} />
                  <Text style={s.resultScore}>–</Text>
                  <ScoreInput value={editAway} onChange={setEditAway} disabled={savingResult} />
                  <TouchableOpacity
                    style={[s.editBtn, s.editBtnSave, savingResult && s.saveBtnDisabled]}
                    onPress={handleSaveResult}
                    disabled={savingResult}
                  >
                    {savingResult
                      ? <ActivityIndicator size="small" color={Colors.bg} />
                      : <Ionicons name="checkmark" size={16} color={Colors.bg} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.editBtn, savingResult && s.saveBtnDisabled]}
                    onPress={() => setEditingResult(false)}
                    disabled={savingResult}
                  >
                    <Ionicons name="close" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={s.resultScore}>
                  {match.result.homeScore} – {match.result.awayScore}
                </Text>
              )}
              {match.resultPenaltyHomeScore != null && (
                <Text style={s.penaltyText}>
                  Penalties: {match.resultPenaltyHomeScore} – {match.resultPenaltyAwayScore}
                </Text>
              )}
              {!match.isAdmin && match.prediction && (
                <Text style={s.pointsText}>+{match.prediction.pointsAwarded} pts</Text>
              )}
            </View>
          )}

          {/* CTA */}
          {!match.isAdmin && (
            locked ? (
              <Text style={s.lockedNote}>Predictions are locked for this match.</Text>
            ) : (
              <TouchableOpacity
                style={[s.saveBtn, saving && s.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={s.saveBtnText}>
                      {match.prediction ? 'Update Prediction' : 'Save Prediction'}
                    </Text>}
              </TouchableOpacity>
            )
          )}
        </View>

        {/* ── H2H ── */}
        {h2h && h2h.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Head to Head</Text>
            <Text style={s.sectionSub}>Last {h2h.length} meeting{h2h.length !== 1 ? 's' : ''}</Text>
            {h2h.map((m, i) => {
              const w = m.homeScore !== null && m.awayScore !== null
                ? m.homeScore > m.awayScore ? 'home' : m.awayScore > m.homeScore ? 'away' : 'draw'
                : null;
              return (
                <View key={i} style={s.h2hRow}>
                  <View style={s.h2hMeta}>
                    <Text style={s.h2hDate}>{formatH2HDate(m.date)}</Text>
                    <Text style={s.h2hComp} numberOfLines={1}>{m.competition}</Text>
                  </View>
                  <View style={s.h2hTeams}>
                    <Text
                      style={[s.h2hTeamName, w === 'home' && s.h2hWinner, w !== null && w !== 'home' && w !== 'draw' && s.h2hLoser]}
                      numberOfLines={1}
                    >
                      {m.homeTeam.name}
                    </Text>
                    <View style={s.h2hScore}>
                      <Text style={s.h2hScoreText}>
                        {m.homeScore ?? '–'} – {m.awayScore ?? '–'}
                      </Text>
                      {m.penaltyHomeScore != null && (
                        <Text style={s.h2hPen}>({m.penaltyHomeScore}–{m.penaltyAwayScore} pen)</Text>
                      )}
                    </View>
                    <Text
                      style={[s.h2hTeamName, s.h2hTeamRight, w === 'away' && s.h2hWinner, w !== null && w !== 'away' && w !== 'draw' && s.h2hLoser]}
                      numberOfLines={1}
                    >
                      {m.awayTeam.name}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── League standings ── */}
        {hasStandings && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>League Standings</Text>
            <View style={s.standingsHeader}>
              <Text style={[s.standingsHeaderText, { width: 80 }]} />
              <Text style={[s.standingsHeaderText, { width: 30, textAlign: 'center' }]}>Pos</Text>
              <Text style={[s.standingsHeaderText, { width: 72, textAlign: 'center' }]}>Record</Text>
              <Text style={[s.standingsHeaderText, { width: 44, textAlign: 'center' }]}>Pts</Text>
              <Text style={[s.standingsHeaderText]}>Form</Text>
            </View>
            <StandingsRow label={match.homeTeam.name} s={match.homeStanding} />
            <StandingsRow label={match.awayTeam.name} s={match.awayStanding} />
          </View>
        )}

        {/* ── All predictions (when locked) ── */}
        {(locked || match.isAdmin) && match.allPredictions && (
          <View style={[s.card, { paddingHorizontal: 0 }]}>
            <Text style={[s.sectionTitle, { paddingHorizontal: 14 }]}>All Predictions</Text>
            {match.allPredictions.length === 0 ? (
              <Text style={[s.emptyText, { paddingHorizontal: 14, paddingBottom: 8 }]}>No predictions submitted.</Text>
            ) : (
              match.allPredictions.map((p) => {
                const awardedRules = match.result
                  ? (p.scoringBreakdown ?? []).filter(r => r.awarded)
                  : [];
                return (
                  <View key={p.userId} style={s.predRow}>
                    <View style={s.predMain}>
                      <Text style={s.predUser}>{p.userName}</Text>
                      <View style={s.predRight}>
                        <Text style={s.predScore}>{p.homeScore} – {p.awayScore}</Text>
                        {match.result && (
                          p.pointsAwarded > 0
                            ? <Text style={s.predPts}>+{p.pointsAwarded} pts</Text>
                            : <Text style={s.predPtsZero}>0 pts</Text>
                        )}
                      </View>
                    </View>
                    {awardedRules.length > 0 && (
                      <View style={s.predBreakdown}>
                        {awardedRules.map((r) => (
                          <View key={r.key} style={s.predPill}>
                            <Text style={s.predPillText}>✓ {r.name} (+{r.points})</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

      </ScrollView>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 12, gap: 12 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: Colors.destructive, fontSize: 14 },

  // Card
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kickoffText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  stageText:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  venueText:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  statusLive:   { borderColor: Colors.destructive },
  statusLocked: { borderColor: Colors.textDim },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },

  // Teams
  teamsContainer: { flexDirection: 'row', alignItems: 'center' },
  teamBlock:   { flex: 1, alignItems: 'center', gap: 8 },
  teamLogo:    { width: 56, height: 56 },
  teamLogoPlaceholder: { width: 56, height: 56, backgroundColor: Colors.muted, borderRadius: 28 },
  teamName:    { fontSize: 13, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  teamPos:     { fontSize: 11, color: Colors.textMuted },
  vsDivider:   { paddingHorizontal: 10 },
  vsText:      { fontSize: 22, fontWeight: '800', color: Colors.textMuted },

  outcomeHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },

  resultBox:    { backgroundColor: Colors.muted, borderRadius: 10, padding: 12, alignItems: 'center', gap: 4 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultLabel:  { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultScore:  { fontSize: 28, fontWeight: '800', color: Colors.text },
  penaltyText:  { fontSize: 12, color: Colors.textMuted },
  pointsText:   { fontSize: 14, fontWeight: '700', color: Colors.yellow },
  editResultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn:      { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  editBtnSave:  { backgroundColor: Colors.primary, borderColor: Colors.primary },

  saveBtn:         { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { fontSize: 15, fontWeight: '700', color: Colors.bg },
  lockedNote:      { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },

  // H2H
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionSub:   { fontSize: 11, color: Colors.textMuted, marginTop: -8 },
  h2hRow:       { gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  h2hMeta:      { flexDirection: 'row', justifyContent: 'space-between' },
  h2hDate:      { fontSize: 10, color: Colors.textMuted },
  h2hComp:      { fontSize: 10, color: Colors.textMuted, maxWidth: 160, textAlign: 'right' },
  h2hTeams:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h2hTeamName:  { flex: 1, fontSize: 12, color: Colors.text },
  h2hTeamRight: { textAlign: 'right' },
  h2hWinner:    { fontWeight: '700' },
  h2hLoser:     { color: Colors.textMuted },
  h2hScore:     { alignItems: 'center', minWidth: 64 },
  h2hScoreText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  h2hPen:       { fontSize: 9, color: Colors.textMuted },

  // Standings
  standingsHeader: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  standingsHeaderText: { fontSize: 10, color: Colors.textDim, fontWeight: '600', textTransform: 'uppercase' },

  // All predictions
  predRow:    { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border, gap: 6 },
  predMain:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  predUser:   { fontSize: 13, fontWeight: '500', color: Colors.text, flex: 1 },
  predRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  predScore:  { fontSize: 13, fontWeight: '700', color: Colors.text },
  predPts:    { fontSize: 13, fontWeight: '700', color: Colors.yellow },
  predPtsZero: { fontSize: 13, color: Colors.textMuted },
  predBreakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  predPill:   { backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  predPillText: { fontSize: 10, color: Colors.green },
  emptyText:  { fontSize: 13, color: Colors.textMuted },
});
