import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme/colors';
import { registerForPushNotifications } from '@/notifications/push';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login';
    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/matches');
    }
  }, [token, loading, segments, router]);

  return <>{children}</>;
}

function PushRegistrar() {
  const { token } = useAuth();
  const registered = useRef<string | null>(null);
  const router = useRouter();

  // Register FCM token once per JWT.
  useEffect(() => {
    if (!token || registered.current === token) return;
    registered.current = token;
    registerForPushNotifications(token).catch(() => {});
  }, [token]);

  // Route notification taps to the relevant screen.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const type = (response.notification.request.content.data as any)?.type as string | undefined;
      if (type === 'results') router.push('/(tabs)/predictions' as any);
      else router.push('/(tabs)/matches');
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="light" />
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
    </SafeAreaProvider>
  );
}
