import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import type { ScoringRuleBreakdown } from '@/types/api';

/**
 * Icon-only trigger — tap opens a centered popup listing only matched rules.
 * Mirrors the web `ScoringBreakdown` component (which uses a hover popover).
 * Renders nothing when no rules matched.
 */
export function ScoringBreakdown({ rules }: { rules: ScoringRuleBreakdown[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const matched = rules.filter(r => r.awarded);
  if (matched.length === 0) return null;

  return (
    <>
      <Pressable
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.6 }]}
        accessibilityLabel="View scoring breakdown"
      >
        <Ionicons
          name="information-circle-outline"
          size={14}
          color={colors.mutedForeground}
        />
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.popover} onPress={e => e.stopPropagation()}>
            <Text style={styles.title}>Rules matched</Text>
            <View style={{ gap: 6 }}>
              {matched.map(r => (
                <View key={r.key} style={styles.row}>
                  <Text style={styles.ruleName}>{r.name}</Text>
                  <Text style={styles.rulePoints}>+{r.points}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    trigger: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    popover: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minWidth: 220,
      maxWidth: 320,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    title: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    ruleName: {
      flex: 1,
      color: c.success,
      fontSize: font.size.xs,
      fontWeight: font.weight.medium,
    },
    rulePoints: {
      color: c.success,
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
      fontVariant: ['tabular-nums'],
    },
  });
}
