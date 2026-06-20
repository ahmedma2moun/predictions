import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ROUTES } from '@/constants/routes';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { registerForPushNotifications } from '@/notifications/push';
import { routeForNotification } from '@/notifications/route-for-notification';

SplashScreen.preventAutoHideAsync();

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
  // Guards against navigating twice for the notification that cold-started the app
  // (the initial response is also delivered to the live listener on some platforms).
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (!token || registered.current === token) return;
    registered.current = token;
    registerForPushNotifications(token).catch(() => {});
  }, [token]);

  // Live taps while the app is running (foreground/background).
  useEffect(() => {
    if (!token) return;
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      router.push(routeForNotification(data) as any);
    });
    return () => sub.remove();
  }, [token, router]);

  // Cold start: the app was launched by tapping a notification while killed.
  // The live listener does not fire for that response, so handle it explicitly
  // once the user is authenticated.
  useEffect(() => {
    if (!token || handledColdStart.current) return;
    handledColdStart.current = true;
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (!response) return;
        const data = response.notification.request.content.data;
        router.push(routeForNotification(data) as any);
      })
      .catch(() => {});
  }, [token, router]);

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
              options={{ headerShown: false }}
            />
          </Stack>
        </AuthGate>
      </AuthProvider>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono: JetBrainsMono_400Regular,
    JetBrainsMonoBold: JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
