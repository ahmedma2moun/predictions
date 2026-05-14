import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, LiveDot, Muted, Pill } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { ROUTES } from '@/constants/routes';
import { useMatches } from '@/hooks/useMatches';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { MatchListItem } from '@/types/api';
import { formatKickoff, formatMatchStatus, formatStage, isKnockoutStage, isMatchLocked, ordinal } from '@/utils/format';

export default function MatchesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { matches, loading, refreshing, error, onRefresh } = useMatches();

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) { isFirstFocus.current = false; return; }
      onRefresh();
    }, [onRefresh]),
  );

  const openCount = useMemo(
    () => matches.filter(m => !isMatchLocked(m.kickoffTime) && m.status === 'scheduled').length,
    [matches],
  );

  const subtitle = matches.length > 0
    ? `${matches.length} fixture${matches.length !== 1 ? 's' : ''} · ${openCount} still open`
    : undefined;

  const renderMatchItem = useCallback(({ item }: { item: MatchListItem }) => (
    <MatchCard match={item} onPress={() => router.push(ROUTES.matchDetail(item._id) as any)} />
  ), [router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Matches" subtitle={subtitle} />
      <FlatList
        data={matches}
        keyExtractor={item => item._id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
            {error ?? 'No upcoming matches available.'}
          </Muted>
        }
        renderItem={renderMatchItem}
      />
    </View>
  );
}

const MatchCard = memo(function MatchCard({ match, onPress }: { match: MatchListItem; onPress: () => void }) {
  const { colors } = useTheme();
  const locked = isMatchLocked(match.kickoffTime);
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const knockout = isKnockoutStage(match.stage);
  const competitionLabel = knockout
    ? `${formatStage(match.stage!)}${match.leg ? ` · Leg ${match.leg}` : ''}`
    : match.matchday
    ? `Matchday ${match.matchday}`
    : '–';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card style={styles.card}>
        {/* Top strip */}
        <View
          style={[
            styles.topStrip,
            { borderBottomColor: colors.border },
            isLive && { backgroundColor: 'rgba(255,77,109,0.06)' },
          ]}
        >
          <Text
            style={[styles.competitionLabel, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {competitionLabel.toUpperCase()}
          </Text>
          <View style={{ flexShrink: 0 }}>
            {isLive ? (
              <Pill tone="live" icon={<LiveDot />}>
                LIVE
              </Pill>
            ) : locked && !isFinished ? (
              <Pill tone="ghost">LOCKED</Pill>
            ) : isFinished ? (
              <Pill tone="ghost">FT</Pill>
            ) : match.prediction ? (
              <Pill tone="brand">PICKED</Pill>
            ) : null}
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <TeamSide name={match.homeTeam.name} logo={match.homeTeam.logo} standing={match.homeStanding} align="left" />

          {/* Score chip */}
          <View
            style={[
              styles.scoreChip,
              {
                backgroundColor: isLive
                  ? colors.cardElevated
                  : match.prediction
                  ? colors.primarySoft
                  : 'transparent',
                borderWidth: (isLive || match.prediction) ? 1 : 0,
                borderColor: match.prediction ? colors.primarySoftBorder : colors.border,
              },
            ]}
          >
            {match.prediction ? (
              <Text style={[styles.scoreText, { color: colors.primary, fontFamily: 'JetBrainsMono', fontSize: 19 }]}>
                {match.prediction.homeScore}–{match.prediction.awayScore}
              </Text>
            ) : isLive ? (
              <Text style={[styles.scoreText, { color: colors.foreground, fontFamily: 'JetBrainsMono', fontSize: 20 }]}>
                –
              </Text>
            ) : (
              <Text style={[styles.vsText, { color: colors.mutedForeground }]}>VS</Text>
            )}
          </View>

          <TeamSide name={match.awayTeam.name} logo={match.awayTeam.logo} standing={match.awayStanding} align="right" />
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.kickoffText, { color: colors.mutedForeground }]}>
            {formatKickoff(match.kickoffTime)}
          </Text>
          <FooterRight match={match} locked={locked} />
        </View>
      </Card>
    </Pressable>
  );
});

function FooterRight({ match, locked }: { match: MatchListItem; locked: boolean }) {
  const { colors } = useTheme();
  if (match.status === 'live') {
    return match.prediction ? (
      <Text style={{ color: colors.mutedForeground, fontSize: font.size.xs }}>
        Your pick:{' '}
        <Text style={{ fontFamily: 'JetBrainsMono', color: colors.foreground }}>
          {match.prediction.homeScore}–{match.prediction.awayScore}
        </Text>
      </Text>
    ) : null;
  }
  if (locked && match.status !== 'finished') {
    return (
      <Text style={{ color: colors.mutedForeground, fontSize: font.size.xs, fontStyle: 'italic' }}>
        {match.prediction ? 'Prediction submitted' : 'No prediction submitted'}
      </Text>
    );
  }
  return <CountdownText kickoffTime={match.kickoffTime} />;
}

function TeamSide({
  name, logo, standing, align,
}: {
  name: string;
  logo: string | null;
  standing: { position: number; points: number } | null;
  align: 'left' | 'right';
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.teamSide, { alignItems: align === 'left' ? 'flex-start' : 'flex-end' }]}>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" />
      ) : (
        <View style={[styles.logo, { backgroundColor: colors.accent, borderRadius: radius.md }]} />
      )}
      <Text
        style={[styles.teamName, { color: colors.foreground, textAlign: align }]}
        numberOfLines={2}
      >
        {name}
      </Text>
      {standing && (
        <Text style={[styles.standing, { color: colors.mutedForeground, fontFamily: 'JetBrainsMono' }]}>
          #{standing.position} · {standing.points}
        </Text>
      )}
    </View>
  );
}

function getCountdownLabel(kickoffTime: string): string | null {
  const ms = new Date(kickoffTime).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return remainHours > 0 ? `${days}d ${remainHours}h to predict` : `${days}d to predict`;
  }
  if (hours > 0) return `${hours}h ${minutes}m to predict`;
  if (totalMinutes > 0) return `${totalMinutes}m to predict`;
  return '< 1m to predict';
}

function CountdownText({ kickoffTime }: { kickoffTime: string }) {
  const { colors } = useTheme();
  const [label, setLabel] = useState(() => getCountdownLabel(kickoffTime));

  useEffect(() => {
    const intervalId = setInterval(() => setLabel(getCountdownLabel(kickoffTime)), 30_000);
    const ms = new Date(kickoffTime).getTime() - Date.now();
    const timeoutId = ms > 0 ? setTimeout(() => { setLabel(null); clearInterval(intervalId); }, ms) : null;
    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [kickoffTime]);

  if (!label) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="time-outline" size={11} color={colors.warning} />
      <Text style={{ color: colors.warning, fontSize: font.size.xs, fontFamily: 'JetBrainsMono', fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  card: { padding: 0, overflow: 'hidden' },
  topStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  competitionLabel: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 16,
    gap: spacing.md,
  },
  teamSide: { flex: 1, gap: 6 },
  logo: { width: 36, height: 36 },
  teamName: { fontSize: font.size.sm, fontWeight: font.weight.semibold },
  standing: { fontSize: 10.5, fontVariant: ['tabular-nums'] },
  scoreChip: {
    minWidth: 70,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  vsText: { fontSize: font.size.xs, fontWeight: '600', letterSpacing: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  kickoffText: { fontSize: 11.5 },
});
