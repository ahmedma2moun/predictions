import { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/LeaderboardRow';
import { Muted } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/theme';
import { useRemoteData } from '@/hooks/useRemoteData';
import { apiRequest } from '@/api/client';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import type { LeaderboardEntry, Season, SeasonWithStandings } from '@/types/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type SeasonEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalPoints: number;
};

type SeasonsData = {
  activeSeason: Season | null;
  activeLeaderboard: SeasonEntry[];
  endedSeasons: (Season & { overallStandings: SeasonEntry[] })[];
};

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function fetchSeasonsData(token: string | null, signal: AbortSignal): Promise<SeasonsData> {
  const seasons = await apiRequest<Season[]>('/api/mobile/seasons', { token, signal });

  const activeSeason = seasons.find(s => s.status === 'ACTIVE') ?? null;
  const endedSeasons = seasons.filter(s => s.status === 'ENDED');

  const lbRaw = activeSeason
    ? await apiRequest<LeaderboardEntry[]>('/api/mobile/leaderboard?period=all', { token, signal })
    : ([] as LeaderboardEntry[]);

  const endedDetails = await Promise.all(
    endedSeasons.map(s =>
      apiRequest<SeasonWithStandings>(`/api/mobile/seasons/${s.id}`, { token, signal }),
    ),
  );

  return {
    activeSeason,
    activeLeaderboard: lbRaw.map(e => ({
      userId: e.userId,
      name: e.name,
      avatarUrl: e.avatarUrl,
      totalPoints: e.totalPoints,
    })),
    endedSeasons: endedDetails.map(s => ({
      ...s,
      overallStandings: s.standings
        .filter(st => st.groupId === null)
        .sort((a, b) => a.rank - b.rank)
        .map(st => ({
          userId: st.userId,
          name: st.userName ?? 'Unknown',
          avatarUrl: null,
          totalPoints: st.totalPoints,
        })),
    })),
  };
}

// ── Podium ────────────────────────────────────────────────────────────────────

const MEDAL = {
  1: { color: '#F2C744', bg: 'rgba(242,199,68,0.33)', border: 'rgba(242,199,68,0.55)', height: 86 },
  2: { color: '#C5CDD9', bg: 'rgba(197,205,217,0.33)', border: 'rgba(197,205,217,0.55)', height: 62 },
  3: { color: '#CB8C5C', bg: 'rgba(203,140,92,0.33)', border: 'rgba(203,140,92,0.55)', height: 48 },
} as const;

function SeasonPodium({ entries, myId }: { entries: SeasonEntry[]; myId: string | undefined }) {
  const { colors } = useTheme();
  const top3 = entries.slice(0, 3);
  if (top3.length < 3) return null;

  const order = [top3[1], top3[0], top3[2]];
  const ranks = [2, 1, 3] as const;

  return (
    <View style={podiumStyles.row}>
      {order.map((entry, i) => {
        const rank = ranks[i];
        const medal = MEDAL[rank];
        const isMe = entry.userId === myId;
        return (
          <View key={entry.userId} style={[podiumStyles.col, rank === 1 && podiumStyles.colFirst]}>
            <Avatar name={entry.name} url={entry.avatarUrl} size={rank === 1 ? 48 : 40} />
            <Text
              style={[podiumStyles.name, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {entry.name.split(' ')[0]}
            </Text>
            <Text
              style={[
                podiumStyles.score,
                { color: isMe ? colors.primary : colors.foreground, fontFamily: 'JetBrainsMonoBold' },
              ]}
            >
              {entry.totalPoints}
            </Text>
            <View
              style={[
                podiumStyles.tower,
                { height: medal.height, backgroundColor: medal.bg, borderColor: medal.border },
              ]}
            >
              <Text style={[podiumStyles.towerNum, { color: medal.color }]}>{rank}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const podiumStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  colFirst: { flex: 1.2 },
  name: { fontSize: font.size.xs, fontWeight: font.weight.semibold, textAlign: 'center' },
  score: { fontSize: 15, fontVariant: ['tabular-nums'] },
  tower: {
    width: '100%',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  towerNum: { fontSize: 20, fontWeight: font.weight.heavy },
});

// ── Compact row ───────────────────────────────────────────────────────────────

function SeasonRow({
  rank, entry, myId, colors,
}: {
  rank: number;
  entry: SeasonEntry;
  myId: string | undefined;
  colors: Palette;
}) {
  const isMe = entry.userId === myId;
  return (
    <View
      style={[
        rowStyles.row,
        {
          backgroundColor: isMe ? colors.primarySoft : colors.card,
          borderColor: isMe ? colors.primarySoftBorder : colors.border,
        },
      ]}
    >
      <View style={rowStyles.rankBox}>
        <Text style={[rowStyles.rank, { color: isMe ? colors.primary : colors.mutedForeground, fontFamily: 'JetBrainsMono' }]}>
          {rank}
        </Text>
      </View>
      <Avatar name={entry.name} url={entry.avatarUrl} size={28} />
      <Text style={[rowStyles.name, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>
        {entry.name}
      </Text>
      {isMe && (
        <Text style={[rowStyles.youTag, { color: colors.primary }]}>YOU</Text>
      )}
      <Text style={[rowStyles.pts, { color: isMe ? colors.primary : colors.foreground, fontFamily: 'JetBrainsMonoBold' }]}>
        {entry.totalPoints}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rankBox: { width: 26, alignItems: 'center' },
  rank: { fontSize: font.size.sm, fontWeight: font.weight.bold, fontVariant: ['tabular-nums'] },
  name: { fontSize: font.size.sm, fontWeight: font.weight.semibold },
  youTag: { fontSize: font.size.xxs, fontWeight: font.weight.bold, letterSpacing: 0.5 },
  pts: { fontSize: 14, fontVariant: ['tabular-nums'] },
});

// ── Standings list (podium + rows) ────────────────────────────────────────────

function StandingsList({ entries, myId }: { entries: SeasonEntry[]; myId: string | undefined }) {
  const { colors } = useTheme();

  if (entries.length === 0) {
    return (
      <Muted style={{ textAlign: 'center', marginVertical: spacing.lg }}>
        No predictions scored yet.
      </Muted>
    );
  }

  const showPodium = entries.length >= 3;
  const compactEntries = showPodium ? entries.slice(3) : entries;

  return (
    <View style={{ gap: spacing.xs }}>
      {showPodium && <SeasonPodium entries={entries} myId={myId} />}
      {compactEntries.map((entry, idx) => (
        <SeasonRow
          key={entry.userId}
          rank={showPodium ? idx + 4 : idx + 1}
          entry={entry}
          myId={myId}
          colors={colors}
        />
      ))}
    </View>
  );
}

// ── Ended season card ─────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function EndedSeasonCard({
  season, myId,
}: {
  season: Season & { overallStandings: SeasonEntry[] };
  myId: string | undefined;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        cardStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={{ gap: 2 }}>
        <Text style={[cardStyles.seasonName, { color: colors.foreground }]}>{season.name}</Text>
        {season.description ? (
          <Muted style={{ fontSize: font.size.xs }}>{season.description}</Muted>
        ) : null}
        <Muted style={{ fontSize: font.size.xxs }}>
          {formatDate(season.startDate)}
          {season.endedAt ? ` → ${formatDate(season.endedAt)}` : ''}
        </Muted>
      </View>
      <StandingsList entries={season.overallStandings} myId={myId} />
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  seasonName: { fontSize: font.size.md, fontWeight: font.weight.semibold },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SeasonsScreen() {
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const myId = user?.id;

  const { data, loading, refreshing, refresh } = useRemoteData(
    (signal) => fetchSeasonsData(token, signal),
    [token],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Seasons" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  const activeSeason = data?.activeSeason ?? null;
  const endedSeasons = data?.endedSeasons ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Seasons" />
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        style={{ backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {/* Active season */}
        {activeSeason && (
          <View style={{ gap: spacing.md }}>
            <View style={styles.seasonHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {activeSeason.name}
              </Text>
              <View style={[styles.badge, { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.35)' }]}>
                <Text style={{ color: colors.success, fontSize: font.size.xxs, fontWeight: font.weight.semibold }}>
                  In Progress
                </Text>
              </View>
            </View>
            <StandingsList entries={data?.activeLeaderboard ?? []} myId={myId} />
          </View>
        )}

        {/* Past seasons */}
        {endedSeasons.length > 0 && (
          <View style={{ gap: spacing.md }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Past Seasons</Text>
            {endedSeasons.map(s => (
              <EndedSeasonCard key={s.id} season={s} myId={myId} />
            ))}
          </View>
        )}

        {/* Empty state */}
        {!activeSeason && endedSeasons.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🏆</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No seasons yet</Text>
            <Muted style={{ textAlign: 'center' }}>
              Check back when a season is started by the admin.
            </Muted>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.xl },
  seasonHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  sectionTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  empty: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl * 2 },
  emptyTitle: { fontSize: font.size.md, fontWeight: font.weight.semibold },
});
