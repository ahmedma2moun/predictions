import React, { useMemo } from 'react';
import {
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
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
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

// ── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Badge({ variant = 'default', children, icon }: BadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const v = {
    default: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
    secondary: { bg: colors.accent, fg: colors.foreground, border: colors.accent },
    destructive: { bg: colors.destructive, fg: '#fff', border: colors.destructive },
  }[variant];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: v.bg, borderColor: v.border },
      ]}
    >
      {icon}
      <Text style={[styles.badgeText, { color: v.fg }]}>{children}</Text>
    </View>
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
