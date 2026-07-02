import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ChampionTeamCard } from '@/components/ChampionTeamCard';
import { ChampionRevealRow } from '@/components/ChampionRevealRow';
import { Muted } from '@/components/ui';
import { useChampionBonus } from '@/hooks/useChampionBonus';
import { useAuth } from '@/auth/AuthContext';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { ChampionBonusAllowedTeam } from '@/types/api';

export default function ChampionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { state, loading, refreshing, onRefresh, picking, pickError, pick } = useChampionBonus();
  const { user } = useAuth();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [confirmTeam, setConfirmTeam] = useState<ChampionBonusAllowedTeam | null>(null);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!state || !state.enabled) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Champion" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👑</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Champion Bonus isn&apos;t running right now
          </Text>
          <Muted style={{ textAlign: 'center', lineHeight: 20 }}>
            Each season the admin picks one league and a subset of its teams. Pick one as your
            champion — once locked, every game they play doubles the bonus:{'\n'}
            <Text style={{ color: colors.foreground, fontWeight: font.weight.semibold }}>
              Win 1 = 2 pts · Win 2 = 4 · Win 3 = 8 …
            </Text>
            {'\n'}Draws and losses still double the next stake — it&apos;s a gamble!
          </Muted>
        </View>
      </View>
    );
  }

  if (state.status === 'OPEN') {
    const openState = state;
    const myTeam = openState.myPick ? openState.allowedTeams.find(t => t.teamId === openState.myPick!.teamId) : null;

    const handlePress = (team: ChampionBonusAllowedTeam) => {
      if (openState.myPick && openState.myPick.teamId !== team.teamId) setConfirmTeam(team);
      else if (!openState.myPick) pick(team.teamId);
    };

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Champion" subtitle={openState.league.name} />
        <FlatList
          data={openState.allowedTeams}
          keyExtractor={t => t.teamId}
          numColumns={3}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
          style={{ backgroundColor: colors.background }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={[styles.banner, { backgroundColor: 'rgba(242,181,68,0.10)', borderColor: colors.warning }]}>
              <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
                👑 Picks are open — the admin can lock at any time
              </Text>
              <Muted style={{ fontSize: font.size.xs, marginTop: 2 }}>
                {openState.pickCount} player{openState.pickCount !== 1 ? 's have' : ' has'} picked.
                {myTeam ? ` You picked ${myTeam.name}.` : ''}
              </Muted>
              {pickError && (
                <Text style={{ color: colors.destructive, fontSize: font.size.xs, marginTop: 6 }}>{pickError}</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ChampionTeamCard
              team={item}
              isPicked={openState.myPick?.teamId === item.teamId}
              isPicking={picking === item.teamId}
              onPress={() => handlePress(item)}
            />
          )}
        />

        <Modal transparent animationType="fade" visible={!!confirmTeam} onRequestClose={() => setConfirmTeam(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setConfirmTeam(null)}>
            <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Switch champion?</Text>
              <Muted style={{ marginBottom: spacing.lg }}>
                Switch from {myTeam?.name} to {confirmTeam?.name}? You can change again anytime before picks lock.
              </Muted>
              <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
                <Pressable
                  onPress={() => setConfirmTeam(null)}
                  style={[styles.modalBtn, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.foreground, fontWeight: font.weight.semibold }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => { if (confirmTeam) pick(confirmTeam.teamId); setConfirmTeam(null); }}
                  style={[styles.modalBtn, { backgroundColor: colors.warning, borderColor: colors.warning }]}
                >
                  <Text style={{ color: colors.background, fontWeight: font.weight.semibold }}>Switch</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // LOCKED reveal
  const myTeam = state.myPick ? state.teams[state.myPick.teamId] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Champion" subtitle={state.league.name} />
      <FlatList
        data={state.picks}
        keyExtractor={p => p.userId}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        style={{ backgroundColor: colors.background }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <View style={[styles.banner, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
              <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
                🔒 Locked {new Date(state.lockedAt).toLocaleDateString()}
              </Text>
              <Muted style={{ fontSize: font.size.xs, marginTop: 2 }}>
                A postponed match finishing late can renumber later games — the ledger rebuilds in kickoff order.
              </Muted>
            </View>
            {myTeam ? (
              <View style={[styles.banner, { backgroundColor: 'rgba(242,181,68,0.10)', borderColor: colors.warning }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Your champion: {myTeam.name}</Text>
                  <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: font.weight.bold, fontFamily: 'JetBrainsMonoBold' }}>
                    +{myTeam.totalPoints}
                  </Text>
                </View>
                <Muted style={{ fontSize: font.size.xs, marginTop: 2 }}>
                  {myTeam.awards.length} game{myTeam.awards.length !== 1 ? 's' : ''} played · next win = {myTeam.nextWinPoints} pts
                </Muted>
              </View>
            ) : (
              <Muted style={{ textAlign: 'center' }}>
                You didn&apos;t pick a champion this round — but you can still browse everyone else&apos;s below.
              </Muted>
            )}
          </View>
        }
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>No one picked a champion this round.</Muted>
        }
        renderItem={({ item }) => (
          <ChampionRevealRow
            pickEntry={item}
            team={state.teams[item.teamId]}
            isMe={item.userId === user?.id}
            isExpanded={expandedUserId === item.userId}
            onToggle={() => setExpandedUserId(v => (v === item.userId ? null : item.userId))}
          />
        )}
      />
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    list: { padding: spacing.lg, gap: spacing.sm },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
    emptyEmoji: { fontSize: 40 },
    emptyTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, textAlign: 'center' },
    banner: {
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
    },
    bannerTitle: { fontSize: font.size.sm, fontWeight: font.weight.semibold },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      width: '100%',
      maxWidth: 340,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.lg,
    },
    modalTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, marginBottom: spacing.xs },
    modalBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
  });
}
