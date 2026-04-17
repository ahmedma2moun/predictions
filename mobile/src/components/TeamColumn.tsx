import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Muted } from '@/components/ui';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import { ordinal } from '@/utils/format';

interface Props {
  name: string;
  logo: string | null;
  position: number | null;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}

export function TeamColumn({ name, logo, position, value, onChange, disabled }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.teamCol}>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.teamLogo} contentFit="contain" />
      ) : (
        <View style={[styles.teamLogo, { backgroundColor: colors.accent, borderRadius: radius.md }]} />
      )}
      <Text style={styles.teamName} numberOfLines={2}>{name}</Text>
      {position && <Muted style={{ fontSize: font.size.xs }}>{ordinal(position)}</Muted>}
      <View style={styles.scoreRow}>
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value <= 0}
          style={({ pressed }) => [
            styles.scoreBtn,
            (disabled || value <= 0) && styles.scoreBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="remove" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={styles.scoreValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.scoreBtn,
            disabled && styles.scoreBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    teamCol: { flex: 1, alignItems: 'center', gap: spacing.sm },
    teamLogo: { width: 56, height: 56 },
    teamName: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
      textAlign: 'center',
    },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
    scoreBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.cardElevated,
    },
    scoreBtnDisabled: { opacity: 0.4 },
    scoreValue: {
      color: c.foreground,
      fontSize: font.size.xxl,
      fontWeight: font.weight.bold,
      fontVariant: ['tabular-nums'],
      width: 40,
      textAlign: 'center',
    },
  });
}
