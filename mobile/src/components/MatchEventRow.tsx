import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { MatchEvent } from '@/types/api';

export type DisplayMatchEvent = MatchEvent & { icons: string[]; ownGoal: boolean };

function singleIcon(event: MatchEvent): { icon: string; ownGoal: boolean } {
  if (event.type === 'goal') {
    const ownGoal = event.detail.toLowerCase().includes('own');
    return { icon: '⚽', ownGoal };
  }
  const isRed = event.detail.toLowerCase().includes('red');
  return { icon: isRed ? '🟥' : '🟨', ownGoal: false };
}

// A second-yellow dismissal comes back from TheSportsDB as two separate
// timeline entries — a Yellow Card immediately followed by a Red Card for
// the same player/minute/team. Collapse that pair into one event row
// showing both icons instead of two rows.
export function mergeMatchEvents(events: MatchEvent[]): DisplayMatchEvent[] {
  const sorted = [...events].sort((a, b) => a.minute - b.minute);
  const used = new Set<number>();
  const result: DisplayMatchEvent[] = [];

  sorted.forEach((e, i) => {
    if (used.has(i)) return;
    if (e.type === 'card' && e.detail.toLowerCase().includes('yellow')) {
      const j = sorted.findIndex((o, idx) =>
        idx > i && !used.has(idx) && o.type === 'card' &&
        o.detail.toLowerCase().includes('red') &&
        o.player === e.player && o.minute === e.minute && o.team === e.team
      );
      if (j !== -1) {
        used.add(i);
        used.add(j);
        result.push({ ...sorted[j], icons: ['🟨', '🟥'], ownGoal: false });
        return;
      }
    }
    used.add(i);
    const { icon, ownGoal } = singleIcon(e);
    result.push({ ...e, icons: [icon], ownGoal });
  });

  return result;
}

function EventIcon({ event, colors }: { event: DisplayMatchEvent; colors: Palette }) {
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        paddingHorizontal: event.icons.length > 1 ? 4 : 0,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        backgroundColor: event.ownGoal ? colors.live + '26' : 'transparent',
      }}
    >
      {event.icons.map((icon, i) => (
        <Text key={i} style={{ fontSize: 11, lineHeight: 13 }}>{icon}</Text>
      ))}
    </View>
  );
}

export function MatchEventRow({ event }: { event: DisplayMatchEvent }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isHome = event.team === 'home';

  return (
    <View style={styles.row}>
      <View style={[styles.side, { justifyContent: 'flex-end' }, !isHome && styles.hidden]}>
        <Text numberOfLines={1} style={[styles.player, { color: colors.foreground, textAlign: 'right' }]}>
          {event.player}
        </Text>
        <EventIcon event={event} colors={colors} />
      </View>
      <Text style={[styles.minute, { color: colors.mutedForeground, fontFamily: 'JetBrainsMono' }]}>
        {event.minute}&apos;
      </Text>
      <View style={[styles.side, isHome && styles.hidden]}>
        <EventIcon event={event} colors={colors} />
        <Text numberOfLines={1} style={[styles.player, { color: colors.foreground }]}>
          {event.player}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
    side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    hidden: { opacity: 0 },
    minute: { width: 32, textAlign: 'center', fontSize: font.size.xs },
    player: { fontSize: font.size.sm, flexShrink: 1 },
  });
}
