import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { MatchEvent } from '@/types/api';

function eventBadge(event: MatchEvent): { icon: string; label: string; ownGoal: boolean } {
  if (event.type === 'goal') {
    const ownGoal = event.detail.toLowerCase().includes('own');
    return { icon: '⚽', label: ownGoal ? 'Own Goal' : 'Goal', ownGoal };
  }
  const isRed = event.detail.toLowerCase().includes('red');
  return { icon: isRed ? '🟥' : '🟨', label: isRed ? 'Red Card' : 'Yellow Card', ownGoal: false };
}

function EventIcon({ event, colors }: { event: MatchEvent; colors: Palette }) {
  const { icon, ownGoal } = eventBadge(event);
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ownGoal ? colors.live + '26' : 'transparent',
      }}
    >
      <Text style={{ fontSize: 11, lineHeight: 13 }}>{icon}</Text>
    </View>
  );
}

export function MatchEventRow({ event }: { event: MatchEvent }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isHome = event.team === 'home';
  const { label, ownGoal } = eventBadge(event);
  const labelColor = ownGoal ? colors.live : colors.mutedForeground;

  return (
    <View style={styles.row}>
      <View style={[styles.side, !isHome && styles.hidden]}>
        <View style={styles.sideTop}>
          <Text numberOfLines={1} style={[styles.player, { color: colors.foreground, textAlign: 'right' }]}>
            {event.player}
          </Text>
          <EventIcon event={event} colors={colors} />
        </View>
        <Text style={[styles.label, { color: labelColor, textAlign: 'right' }]}>{label}</Text>
      </View>
      <Text style={[styles.minute, { color: colors.mutedForeground, fontFamily: 'JetBrainsMono' }]}>
        {event.minute}&apos;
      </Text>
      <View style={[styles.side, isHome && styles.hidden]}>
        <View style={[styles.sideTop, { justifyContent: 'flex-start' }]}>
          <EventIcon event={event} colors={colors} />
          <Text numberOfLines={1} style={[styles.player, { color: colors.foreground }]}>
            {event.player}
          </Text>
        </View>
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
    side: { flex: 1, gap: 2, minWidth: 0 },
    sideTop: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
    hidden: { opacity: 0 },
    minute: { width: 32, textAlign: 'center', fontSize: font.size.xs },
    player: { fontSize: font.size.sm, flexShrink: 1 },
    label: { fontSize: 10 },
  });
}
