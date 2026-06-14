import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Card, Muted } from '@/components/ui';
import { ScoringBreakdown } from '@/components/ScoringBreakdown';
import { OddsPopover, getPredictedOutcome } from '@/components/OddsFactors';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { MatchDetail, PredictionHistoryItem } from '@/types/api';
import { formatKickoff } from '@/utils/format';

type OtherPrediction = NonNullable<MatchDetail['allPredictions']>[number];

export const PredictionCard = memo(function PredictionCard({ pred }: { pred: PredictionHistoryItem }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const match = pred.match;
  const isFinished = match.status === 'finished';
  const isLocked = match.status !== 'scheduled';
  const isExact =
    isFinished &&
    match.result &&
    pred.homeScore === match.result.homeScore &&
    pred.awayScore === match.result.awayScore;

  const [open, setOpen]                   = useState(false);
  const [others, setOthers]               = useState<OtherPrediction[] | null>(null);
  const [loadingOthers, setLoadingOthers] = useState(false);

  const toggle = useCallback(async () => {
    if (!open && others === null && token) {
      setLoadingOthers(true);
      try {
        const data = await apiRequest<MatchDetail>(`/api/mobile/matches/${match._id}`, { token });
        setOthers(data.allPredictions ?? []);
      } catch {
        setOthers([]);
      } finally {
        setLoadingOthers(false);
      }
    }
    setOpen(v => !v);
  }, [open, others, token, match._id]);

  const pts = pred.pointsAwarded ?? 0;
  const chipBg = isExact ? colors.primarySoft : pts > 0 ? colors.cardElevated : colors.cardElevated;
  const chipBorder = isExact ? colors.primarySoftBorder : colors.border;
  const chipValueColor = isExact ? colors.primary : pts > 0 ? colors.warning : colors.mutedForeground;

  return (
    <Card style={styles.tile}>
      {/* Main row: left info + right points chip */}
      <View style={styles.mainRow}>
        {/* Left column */}
        <View style={styles.leftCol}>
          <Text style={[styles.dayCaption, { color: colors.mutedForeground }]}>
            {formatKickoff(match.kickoffTime)}
          </Text>
          <Text style={[styles.matchTitle, { color: colors.foreground }]} numberOfLines={1}>
            {match.homeTeam.name}{' '}
            <Text style={{ color: colors.mutedForeground, fontWeight: font.weight.regular }}>vs</Text>
            {' '}{match.awayTeam.name}
          </Text>
          {isFinished && match.result && (
            <View style={styles.picksRow}>
              <ScoreCell
                label="PICK"
                score={`${pred.homeScore}–${pred.awayScore}`}
                dim
                colors={colors}
              />
              <ScoreCell
                label="FINAL"
                score={`${match.result.homeScore}–${match.result.awayScore}`}
                dim={false}
                colors={colors}
              />
              {match.odds && (
                <OddsPopover
                  odds={match.odds}
                  picked={pred.oddsBonus && pred.oddsBonus.finalScore !== pred.oddsBonus.baseScore
                    ? getPredictedOutcome(pred.homeScore, pred.awayScore)
                    : undefined}
                  homeTeamName={match.homeTeam.name}
                  awayTeamName={match.awayTeam.name}
                  style={{ alignSelf: 'flex-end', paddingBottom: 1 }}
                />
              )}
            </View>
          )}
          {!isFinished && (
            <View style={styles.picksRow}>
              <ScoreCell label="YOUR PICK" score={`${pred.homeScore}–${pred.awayScore}`} dim colors={colors} />
            </View>
          )}
        </View>

        {/* Right points chip */}
        {isFinished && (
          <View style={[styles.ptsChip, { backgroundColor: chipBg, borderColor: chipBorder }]}>
            <Text style={[styles.ptsValue, { color: chipValueColor, fontFamily: 'JetBrainsMonoBold' }]}>
              {pts > 0 ? `+${pts}` : '0'}
            </Text>
            <Text style={[styles.ptsCaption, { color: chipValueColor }]}>
              {isExact ? 'EXACT' : 'pts'}
            </Text>
            {pred.scoringBreakdown && pred.scoringBreakdown.length > 0 && (
              <ScoringBreakdown rules={pred.scoringBreakdown} bonus={pred.oddsBonus} />
            )}
          </View>
        )}
      </View>

      {/* Expand toggle */}
      {isLocked && (
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [
            styles.toggleBtn,
            { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          {loadingOthers ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <>
              <Text style={[styles.toggleText, { color: colors.mutedForeground }]}>
                {open ? 'Hide' : 'Show'} all predictions
              </Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
            </>
          )}
        </Pressable>
      )}

      {/* Expanded others */}
      {open && others && others.length > 0 && (
        <View style={styles.othersBox}>
          {others.map(o => (
            <View key={o.userId} style={[styles.otherRow, { backgroundColor: colors.cardElevated }]}>
              <Text style={[styles.otherName, { color: colors.foreground }]} numberOfLines={1}>
                {o.userName}
              </Text>
              <View style={styles.otherRight}>
                <Text style={[styles.otherScore, { color: colors.foreground, fontFamily: 'JetBrainsMono' }]}>
                  {o.homeScore}–{o.awayScore}
                </Text>
                {isFinished && (
                  <>
                    <Text style={[styles.otherPts, { color: (o.pointsAwarded ?? 0) > 0 ? colors.warning : colors.mutedForeground }]}>
                      +{o.pointsAwarded ?? 0}
                    </Text>
                    {o.scoringBreakdown && o.scoringBreakdown.length > 0 && (
                      <ScoringBreakdown rules={o.scoringBreakdown} bonus={o.oddsBonus} />
                    )}
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {open && others && others.length === 0 && (
        <Muted style={{ textAlign: 'center', marginTop: spacing.xs, fontSize: font.size.xs }}>
          No other predictions.
        </Muted>
      )}
    </Card>
  );
});

function ScoreCell({
  label,
  score,
  dim,
  colors,
}: {
  label: string;
  score: string;
  dim: boolean;
  colors: any;
}) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text
        style={{
          color: dim ? colors.mutedForeground : colors.foreground,
          fontSize: 12.5,
          fontFamily: 'JetBrainsMono',
          fontVariant: ['tabular-nums'] as any,
          fontWeight: dim ? '400' : '700',
        }}
      >
        {score}
      </Text>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    tile: { gap: spacing.xs, paddingVertical: spacing.md },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    leftCol: { flex: 1, gap: 5, minWidth: 0 },
    dayCaption: { fontSize: font.size.xs },
    matchTitle: { fontSize: 13.5, fontWeight: font.weight.semibold },
    picksRow: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
    ptsChip: {
      width: 72,
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      gap: 2,
      flexShrink: 0,
    },
    ptsValue: {
      fontSize: 22,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
      lineHeight: 26,
    },
    ptsCaption: { fontSize: 9.5, fontWeight: font.weight.bold, letterSpacing: 0.5 },
    toggleBtn: {
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    toggleText: { fontSize: font.size.xs, fontWeight: font.weight.medium },
    othersBox: { marginTop: spacing.xs, gap: 4 },
    otherRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      gap: spacing.sm,
    },
    otherName: { flex: 1, fontSize: font.size.xs, fontWeight: font.weight.medium },
    otherRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    otherScore: { fontSize: font.size.xs, fontVariant: ['tabular-nums'] },
    otherPts: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
  });
}
