import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ROUTES } from '@/constants/routes';
import { colors, font, radius, spacing } from '@/theme/colors';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { registerForPushNotifications, getMessaging } from '@/notifications/push';
import { routeForNotification } from '@/notifications/route-for-notification';

SplashScreen.preventAutoHideAsync();

// Falls back to the static dark palette rather than useTheme() — if the crash happened
// above ThemeProvider in the tree, that context won't be available here either.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, paddingTop: insets.top }}>
      <Text style={{ fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.foreground, textAlign: 'center' }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: font.size.sm, color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg }}>
        {error.message}
      </Text>
      <Pressable
        onPress={retry}
        style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
      >
        <Text style={{ color: colors.primaryForeground, fontWeight: font.weight.semibold }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login';
    if (!token && !inAuthGroup) {
      router.replace(ROUTES.login);
    } else if (token && inAuthGroup) {
      router.replace(ROUTES.matches);
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

  // Live taps while the app is running (foreground/background). Routed
  // through RNFirebase's messaging() when available — see getMessaging()'s
  // doc comment for why expo-notifications' own listener doesn't see these.
  useEffect(() => {
    if (!token) return;
    const rnMessaging = getMessaging();
    if (rnMessaging) {
      return rnMessaging().onNotificationOpenedApp(remoteMessage => {
        router.push(routeForNotification(remoteMessage.data));
      });
    }
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      router.push(routeForNotification(data));
    });
    return () => sub.remove();
  }, [token, router]);

  // Cold start: the app was launched by tapping a notification while killed.
  // The live listener does not fire for that response, so handle it explicitly
  // once the user is authenticated.
  useEffect(() => {
    if (!token || handledColdStart.current) return;
    handledColdStart.current = true;
    const rnMessaging = getMessaging();
    if (rnMessaging) {
      rnMessaging()
        .getInitialNotification()
        .then(remoteMessage => {
          if (remoteMessage) router.push(routeForNotification(remoteMessage.data));
        })
        .catch(() => {});
      return;
    }
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (!response) return;
        const data = response.notification.request.content.data;
        router.push(routeForNotification(data));
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
