import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { colors, font, spacing } from '@/theme/colors';
import { ApiError } from '@/api/client';

export default function LoginScreen() {
  const { signIn } = useAuth();
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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Card style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.emoji}>⚽</Text>
              <Text style={styles.title}>Football Predictions</Text>
              <Text style={styles.subtitle}>Sign in to your account</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
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
              <Text style={styles.label}>Password</Text>
              <Input
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
              />
            </View>

            <Button fullWidth onPress={handleSubmit} loading={loading}>
              Sign In
            </Button>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  container: { padding: spacing.lg },
  card: { gap: spacing.md, maxWidth: 420, alignSelf: 'center', width: '100%' },
  header: { alignItems: 'center', marginBottom: spacing.md, gap: 4 },
  emoji: { fontSize: 40 },
  title: {
    color: colors.foreground,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
  },
  subtitle: { color: colors.mutedForeground, fontSize: font.size.sm },
  field: { gap: spacing.xs },
  label: {
    color: colors.foreground,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
  },
});
