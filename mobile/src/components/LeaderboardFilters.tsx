import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { LeaderboardGroup, LeaderboardLeague } from '@/types/api';
import type { Period } from '@/hooks/usePeriodFilter';
import { PeriodFilterBar } from './PeriodFilterBar';

interface Props {
  groups: LeaderboardGroup[];
  groupId: string | null;
  setGroupId: (id: string) => void;
  leagues: LeaderboardLeague[];
  selectedLeagues: string[];
  setSelectedLeagues: React.Dispatch<React.SetStateAction<string[]>>;
  leagueDropdownOpen: boolean;
  setLeagueDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  period: Period;
  setPeriod: (p: Period) => void;
  weekLabel: string;
  monthLabel: string;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  setMonthOffset: React.Dispatch<React.SetStateAction<number>>;
}

export function LeaderboardFilters({
  groups, groupId, setGroupId,
  leagues, selectedLeagues, setSelectedLeagues,
  leagueDropdownOpen, setLeagueDropdownOpen,
  period, setPeriod,
  weekLabel, monthLabel,
  setWeekOffset, setMonthOffset,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={{ gap: spacing.md }}>
      {groups.length > 1 && (
        <View style={styles.chipRow}>
          {groups.map(g => {
            const active = g.id === groupId;
            return (
              <Pressable
                key={g.id}
                onPress={() => setGroupId(g.id)}
                style={({ pressed }) => [
                  styles.chip,
                  active ? styles.chipActive : styles.chipInactive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={active ? styles.chipTextActive : styles.chipText}>{g.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {leagues.length > 0 && (
        <LeagueMultiSelect
          leagues={leagues}
          selected={selectedLeagues}
          setSelected={setSelectedLeagues}
          open={leagueDropdownOpen}
          setOpen={setLeagueDropdownOpen}
        />
      )}

      <PeriodFilterBar
        period={period}
        setPeriod={setPeriod}
        weekLabel={weekLabel}
        monthLabel={monthLabel}
        setWeekOffset={setWeekOffset}
        setMonthOffset={setMonthOffset}
      />
    </View>
  );
}

function LeagueMultiSelect({
  leagues, selected, setSelected, open, setOpen,
}: {
  leagues: LeaderboardLeague[];
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const label = useMemo(() => {
    if (selected.length === 0) return 'All Tournaments';
    if (selected.length === 1) {
      const l = leagues.find(x => x.externalId.toString() === selected[0]);
      return l?.name ?? '1 selected';
    }
    return `${selected.length} tournaments`;
  }, [selected, leagues]);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={({ pressed }) => [
          styles.dropdown,
          open && { borderColor: colors.primary },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.dropdownText} numberOfLines={1}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>

      {open && (
        <Card style={styles.dropdownPanel}>
          <CheckboxRow
            label="All Tournaments"
            checked={selected.length === 0}
            onPress={() => setSelected([])}
            bold={selected.length === 0}
          />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
          {leagues.map(l => {
            const val = l.externalId.toString();
            const checked = selected.includes(val);
            return (
              <CheckboxRow
                key={l.id}
                label={l.name}
                checked={checked}
                onPress={() =>
                  setSelected(prev => (checked ? prev.filter(x => x !== val) : [...prev, val]))
                }
              />
            );
          })}
        </Card>
      )}
    </View>
  );
}

function CheckboxRow({
  label, checked, onPress, bold,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  bold?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.checkboxRow, pressed && { backgroundColor: colors.accent }]}
    >
      <View
        style={[
          styles.checkbox,
          checked
            ? { backgroundColor: colors.primary, borderColor: colors.primary }
            : { borderColor: colors.border },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />}
      </View>
      <Text style={[styles.checkboxLabel, bold && { fontWeight: font.weight.semibold }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    chipInactive: { backgroundColor: c.card, borderColor: c.border },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.mutedForeground, fontSize: font.size.sm, fontWeight: font.weight.medium },
    chipTextActive: { color: c.primaryForeground, fontSize: font.size.sm, fontWeight: font.weight.semibold },

    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    dropdownText: { color: c.foreground, fontSize: font.size.sm, flex: 1 },
    dropdownPanel: { marginTop: 6, padding: 0, overflow: 'hidden' },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    checkbox: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxLabel: { color: c.foreground, fontSize: font.size.sm },
  });
}
