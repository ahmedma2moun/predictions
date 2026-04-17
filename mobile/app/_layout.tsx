import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ROUTES } from '@/constants/routes';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { registerForPushNotifications } from '@/notifications/push';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login';
    if (!token && !inAuthGroup) {
      router.replace(ROUTES.login as any);
    } else if (token && inAuthGroup) {
      router.replace(ROUTES.matches as any);
    }
  }, [token, loading, segments, router]);

  return <>{children}</>;
}

function PushRegistrar() {
  const { token } = useAuth();
  const registered = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!token || registered.current === token) return;
    registered.current = token;
    registerForPushNotifications(token).catch(() => {});
  }, [token]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const type = (response.notification.request.content.data as any)?.type as string | undefined;
      if (type === 'results') router.push(ROUTES.predictions as any);
      else router.push(ROUTES.matches as any);
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

function ThemedShell() {
  const { colors, mode } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AuthProvider>
        <AuthGate>
          <PushRegistrar />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.card },
              headerTintColor: colors.foreground,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="matches/[matchId]"
              options={{ title: 'Predict Score', headerBackTitle: 'Back' }}
            />
          </Stack>
        </AuthGate>
      </AuthProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
