import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LeaderboardFilters } from '@/components/LeaderboardFilters';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { Muted } from '@/components/ui';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import type { LeaderboardEntry } from '@/types/api';
import { font, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const {
    myId,
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

  const renderItem = useCallback(
    ({ item, index }: { item: LeaderboardEntry; index: number }) => (
      <LeaderboardRow
        item={item}
        index={index}
        myId={myId}
        isExpanded={expandedUserId === item.userId}
        expandedLoading={expandedLoading}
        expandedData={expandedUserId === item.userId ? expandedData : null}
        onToggle={toggleExpand}
      />
    ),
    [myId, expandedUserId, expandedLoading, expandedData, toggleExpand],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={e => e.userId}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: colors.background }}
      extraData={{ expandedUserId, expandedLoading }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing.md }}>
          <Text style={styles.heading}>Leaderboard</Text>
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
        </View>
      }
      ListEmptyComponent={
        <Muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
          No predictions yet
        </Muted>
      }
      renderItem={renderItem}
    />
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
    heading: {
      color: c.foreground,
      fontSize: font.size.xl,
      fontWeight: font.weight.bold,
    },
  });
}
