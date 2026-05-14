import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: spacing.lg,
    },
    button: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    buttonText: {
      fontSize: font.size.md,
      fontWeight: font.weight.semibold,
    },
    input: {
      height: 46,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.input,
      backgroundColor: c.cardElevated,
      paddingHorizontal: spacing.md,
      color: c.foreground,
      fontSize: font.size.md,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
    },
    badgeText: {
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
    },
  });
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ style, children, ...rest }: ViewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

// ── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends Omit<PressableProps, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  loading,
  fullWidth,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDisabled = disabled || loading;
  const variantStyle = {
    primary: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.foreground, border: 'transparent' },
    destructive: { bg: colors.destructive, fg: '#fff', border: colors.destructive },
  }[variant];

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        typeof style === 'function' ? undefined : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.fg} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: variantStyle.fg }]}>{children}</Text>
      )}
    </Pressable>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────
export const Input = React.forwardRef<TextInput, TextInputProps>(function Input(
  { style, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.mutedForeground}
      style={[styles.input, style]}
      {...rest}
    />
  );
});

// ── Pill ─────────────────────────────────────────────────────────────────────
type PillTone = 'brand' | 'live' | 'amber' | 'neutral' | 'ghost';

interface PillProps {
  tone?: PillTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Pill({ tone = 'neutral', children, icon }: PillProps) {
  const { colors } = useTheme();
  const toneStyle = {
    brand:   { bg: colors.primarySoft,            fg: colors.primary,         border: colors.primarySoftBorder },
    live:    { bg: 'rgba(255,77,109,0.14)',        fg: colors.live,            border: 'rgba(255,77,109,0.35)' },
    amber:   { bg: 'rgba(242,181,68,0.14)',        fg: colors.warning,         border: 'rgba(242,181,68,0.35)' },
    neutral: { bg: colors.cardElevated,            fg: colors.mutedForeground, border: colors.border },
    ghost:   { bg: 'transparent',                  fg: colors.mutedForeground, border: colors.border },
  }[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        backgroundColor: toneStyle.bg,
        borderColor: toneStyle.border,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: font.size.xs,
          fontWeight: font.weight.bold,
          color: toneStyle.fg,
          letterSpacing: 0.5,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

// keep Badge as alias for back-compat consumers
interface BadgeProps {
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Badge({ variant = 'default', children, icon }: BadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const v = {
    default:     { bg: colors.primary,     fg: colors.primaryForeground, border: colors.primary },
    outline:     { bg: 'transparent',      fg: colors.foreground,        border: colors.border },
    secondary:   { bg: colors.accent,      fg: colors.foreground,        border: colors.accent },
    destructive: { bg: colors.destructive, fg: '#fff',                   border: colors.destructive },
  }[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border }]}>
      {icon}
      <Text style={[styles.badgeText, { color: v.fg }]}>{children}</Text>
    </View>
  );
}

// ── LiveDot ──────────────────────────────────────────────────────────────────
export function LiveDot() {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.6, duration: 800, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        ]),
      ]),
    ).start();
  }, [scale, opacity]);

  return (
    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.live,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.live }} />
    </View>
  );
}

// ── IconBtn ───────────────────────────────────────────────────────────────────
interface IconBtnProps extends Omit<PressableProps, 'children'> {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
}

export function IconBtn({ name, size = 20, color, style, ...rest }: IconBtnProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        {
          width: 36,
          height: 36,
          borderRadius: radius.pill,
          backgroundColor: colors.cardElevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.65 : 1,
        },
        typeof style === 'function' ? undefined : style,
      ]}
      {...rest}
    >
      <Ionicons name={name} size={size} color={color ?? colors.foreground} />
    </Pressable>
  );
}

// ── SectionTitle ─────────────────────────────────────────────────────────────
export function SectionTitle({ style, children, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        { color: colors.foreground, fontSize: font.size.sm, fontWeight: font.weight.bold },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

// ── Typography ───────────────────────────────────────────────────────────────
export function Muted({ style, children, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text style={[{ color: colors.mutedForeground, fontSize: font.size.sm }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Heading({ style, children, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        { color: colors.foreground, fontSize: font.size.xl, fontWeight: font.weight.bold },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
