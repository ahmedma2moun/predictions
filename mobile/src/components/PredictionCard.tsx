import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Card, Muted } from '@/components/ui';
import { ScoringBreakdown } from '@/components/ScoringBreakdown';
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

  const awardedHighlight = isFinished && pred.pointsAwarded > 0;

  return (
    <Card style={[styles.predCard, awardedHighlight && { borderColor: colors.primarySoftBorder }]}>
      <View style={styles.cardTop}>
        <Muted style={{ fontSize: font.size.xs }}>{formatKickoff(match.kickoffTime)}</Muted>
        <View style={styles.cardTopRight}>
          <Badge variant={isFinished ? 'secondary' : 'outline'}>
            {match.status.toUpperCase()}
          </Badge>
          {isFinished && (
            <View style={styles.pointsWithInfo}>
              <Badge variant={pred.pointsAwarded > 0 ? 'default' : 'secondary'}>
                +{pred.pointsAwarded} pts
              </Badge>
              {pred.scoringBreakdown && pred.scoringBreakdown.length > 0 && (
                <ScoringBreakdown rules={pred.scoringBreakdown} />
              )}
            </View>
          )}
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.sideCol}>
          <Muted style={styles.gridLabel}>Home</Muted>
          <Text style={styles.teamName} numberOfLines={2}>{match.homeTeam.name}</Text>
        </View>
        <View style={styles.pickCol}>
          <Muted style={styles.gridLabel}>Your pick</Muted>
          <Text style={styles.pickScore}>{pred.homeScore} – {pred.awayScore}</Text>
          {isFinished && match.result && (
            <Muted style={{ fontSize: font.size.xs, textAlign: 'center' }}>
              Result: {match.result.homeScore} – {match.result.awayScore}
              {match.result.penaltyHomeScore != null && (
                <> ({match.result.penaltyHomeScore} – {match.result.penaltyAwayScore} pen)</>
              )}
            </Muted>
          )}
        </View>
        <View style={styles.sideCol}>
          <Muted style={styles.gridLabel}>Away</Muted>
          <Text style={styles.teamName} numberOfLines={2}>{match.awayTeam.name}</Text>
        </View>
      </View>

      {isLocked && (
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [styles.toggleBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          {loadingOthers ? (
            <Text style={styles.toggleText}>Loading…</Text>
          ) : (
            <>
              <Text style={styles.toggleText}>{open ? 'Hide' : 'Show'} all predictions</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
            </>
          )}
        </Pressable>
      )}

      {open && others && others.length > 0 && (
        <View style={styles.othersBox}>
          {others.map(o => (
            <View key={o.userId} style={styles.otherRow}>
              <Text style={styles.otherName} numberOfLines={1}>{o.userName}</Text>
              <View style={styles.otherRight}>
                <Text style={styles.otherScore}>{o.homeScore} – {o.awayScore}</Text>
                {isFinished && (
                  <>
                    <Text style={[
                      styles.otherPts,
                      { color: (o.pointsAwarded ?? 0) > 0 ? colors.success : colors.mutedForeground },
                    ]}>
                      +{o.pointsAwarded ?? 0} pts
                    </Text>
                    {o.scoringBreakdown && o.scoringBreakdown.length > 0 && (
                      <ScoringBreakdown rules={o.scoringBreakdown} />
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

function makeStyles(c: Palette) {
  return StyleSheet.create({
    predCard: { gap: spacing.sm, paddingVertical: spacing.md },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    pointsWithInfo: { flexDirection: 'row', alignItems: 'center', gap: 2 },

    grid: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sideCol: { flex: 1, alignItems: 'center', gap: 2 },
    pickCol: { flex: 1, alignItems: 'center', gap: 2 },
    gridLabel: { fontSize: font.size.xs },
    teamName: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.medium,
      textAlign: 'center',
    },
    pickScore: {
      color: c.foreground,
      fontSize: font.size.lg,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
    },

    toggleBtn: {
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    toggleText: { color: c.mutedForeground, fontSize: font.size.xs, fontWeight: font.weight.medium },

    othersBox: { marginTop: spacing.xs, gap: 4 },
    otherRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: c.cardElevated,
      gap: spacing.sm,
    },
    otherName: { flex: 1, color: c.foreground, fontSize: font.size.xs, fontWeight: font.weight.medium },
    otherRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    otherScore: { color: c.foreground, fontSize: font.size.xs, fontVariant: ['tabular-nums'] },
    otherPts: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
  });
}
