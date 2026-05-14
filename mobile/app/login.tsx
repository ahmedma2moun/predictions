import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';
import { ApiError } from '@/api/client';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Invalid email or password';
      Alert.alert('Sign in failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo tile */}
        <View style={[styles.logoTile, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftBorder }]}>
          <Text style={{ fontSize: 28 }}>⚽</Text>
        </View>

        {/* Hero copy */}
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          {'Predict the\nbeautiful game.'}
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
          Score your picks against friends across the Premier League, UCL and more.
        </Text>

        <View style={styles.spacer} />

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
            <Input
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
            <Input
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
            />
          </View>

          <Button
            fullWidth
            onPress={handleSubmit}
            loading={loading}
            style={{ height: 54, borderRadius: radius.lg }}
          >
            Sign In
          </Button>
        </View>

        {/* Footer microcopy */}
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          By continuing, you agree to our Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
    },
    logoTile: {
      width: 56,
      height: 56,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    heroTitle: {
      fontSize: font.size.display,
      fontWeight: font.weight.bold,
      letterSpacing: -1.2,
      lineHeight: 42,
      marginBottom: spacing.md,
    },
    heroSubtitle: {
      fontSize: 14.5,
      lineHeight: 22,
    },
    spacer: { flex: 1, minHeight: spacing.xxl },
    form: { gap: spacing.md },
    field: { gap: spacing.xs },
    label: {
      fontSize: font.size.sm,
      fontWeight: font.weight.medium,
    },
    footer: {
      marginTop: spacing.xl,
      fontSize: 11.5,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
