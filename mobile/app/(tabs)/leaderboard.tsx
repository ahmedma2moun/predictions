import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LeaderboardFilters } from '@/components/LeaderboardFilters';
import { LeaderboardRow, Podium } from '@/components/LeaderboardRow';
import { AppHeader } from '@/components/AppHeader';
import { Muted } from '@/components/ui';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import type { LeaderboardEntry } from '@/types/api';
import { spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    myId,
    isCurrentPeriod,
    period, setPeriod,
    weekOffset, setWeekOffset,
    monthOffset, setMonthOffset,
    groups, groupId, setGroupId,
    leagues, selectedLeagues, setSelectedLeagues,
    leagueDropdownOpen, setLeagueDropdownOpen,
    entries,
    loading,
    refreshing, onRefresh,
    expandedUserId,
    expandedLoading,
    expandedData,
    toggleExpand,
    weekLabel,
    monthLabel,
  } = useLeaderboard();

  const showPodium = entries.length >= 3 && isCurrentPeriod;
  const listEntries = entries;

  // subtitle: group name + player count
  const groupName = groups.find(g => g.id === groupId)?.name;
  const subtitle = groupName
    ? `${groupName} · ${entries.length} player${entries.length !== 1 ? 's' : ''}`
    : `${entries.length} player${entries.length !== 1 ? 's' : ''}`;

  const renderItem = useCallback(
    ({ item, index }: { item: LeaderboardEntry; index: number }) => (
      <LeaderboardRow
        item={item}
        index={index}
        myId={myId}
        isCurrentPeriod={isCurrentPeriod}
        isExpanded={expandedUserId === item.userId}
        expandedLoading={expandedLoading}
        expandedData={expandedUserId === item.userId ? expandedData : null}
        onToggle={toggleExpand}
        showMedal={showPodium && index < 3}
      />
    ),
    [myId, isCurrentPeriod, expandedUserId, expandedLoading, expandedData, toggleExpand, showPodium],
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Leaders" subtitle={entries.length > 0 ? subtitle : undefined} />
      <FlatList
        data={listEntries}
        keyExtractor={e => e.userId}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        style={{ backgroundColor: colors.background }}
        extraData={{ expandedUserId, expandedLoading }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <LeaderboardFilters
              groups={groups}
              groupId={groupId}
              setGroupId={setGroupId}
              leagues={leagues}
              selectedLeagues={selectedLeagues}
              setSelectedLeagues={setSelectedLeagues}
              leagueDropdownOpen={leagueDropdownOpen}
              setLeagueDropdownOpen={setLeagueDropdownOpen}
              period={period}
              setPeriod={setPeriod}
              weekLabel={weekLabel}
              monthLabel={monthLabel}
              setWeekOffset={setWeekOffset}
              setMonthOffset={setMonthOffset}
            />
            {showPodium && (
              <Podium entries={entries} myId={myId} />
            )}
          </View>
        }
        ListEmptyComponent={
          <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
            No predictions yet
          </Muted>
        }
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.xs, paddingTop: spacing.sm },
});
