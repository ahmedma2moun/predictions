import { useEffect, useRef, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Colors } from '@/lib/constants';
import { getToken, onAuthCleared } from '@/lib/auth';
import { addNotificationResponseListener, setupNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed]  = useState(false);
  const notifSub = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const token = await getToken();
        if (token) {
          setAuthed(true);
          // Best-effort; errors are swallowed inside setupNotifications
          setupNotifications().catch(() => {});
        }
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  // Navigate to /login whenever a 401 clears credentials
  useEffect(() => {
    return onAuthCleared(() => {
      setAuthed(false);
      router.replace('/login');
    });
  }, []);

  // Route to the correct screen on notification tap
  useEffect(() => {
    notifSub.current = addNotificationResponseListener((matchId) => {
      router.push(`/match/${matchId}`);
    });
    return () => { notifSub.current?.remove(); };
  }, []);

  // Redirect once we know auth state
  useEffect(() => {
    if (!ready) return;
    if (authed) router.replace('/(tabs)');
    else router.replace('/login');
  }, [ready, authed]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <Stack
        screenOptions={{
          headerStyle:      { backgroundColor: Colors.card },
          headerTintColor:  Colors.text,
          headerTitleStyle: { color: Colors.text, fontWeight: '700' },
          contentStyle:     { backgroundColor: Colors.bg },
          animation:        'slide_from_right',
        }}
      >
        <Stack.Screen name="index"             options={{ headerShown: false }} />
        <Stack.Screen name="login"            options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"           options={{ headerShown: false }} />
        <Stack.Screen
          name="match/[matchId]"
          options={{
            title:       'Match',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen name="+not-found" options={{ headerShown: true }} />
      </Stack>
    </>
  );
}
