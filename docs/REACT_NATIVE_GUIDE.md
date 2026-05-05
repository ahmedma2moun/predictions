# React Native Mobile App Guide

A complete guide for building a React Native mobile companion to the Football Predictions web app. Covers project setup, authentication, all screens, push notifications, and full iOS deployment via Expo EAS + Firebase + GitHub Actions.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Setup](#2-project-setup)
3. [Project Structure](#3-project-structure)
4. [Environment & Configuration](#4-environment--configuration)
5. [Authentication](#5-authentication)
6. [API Client](#6-api-client)
7. [Navigation](#7-navigation)
8. [Screens](#8-screens)
9. [Data Hooks](#9-data-hooks)
10. [Components](#10-components)
11. [Push Notifications with Firebase](#11-push-notifications-with-firebase)
12. [Theming (Dark / Light Mode)](#12-theming-dark--light-mode)
13. [TypeScript Types](#13-typescript-types)
14. [EAS Build Setup](#14-eas-build-setup)
15. [iOS Certificates & Provisioning](#15-ios-certificates--provisioning)
16. [GitHub Actions CI/CD](#16-github-actions-cicd)
17. [Firebase App Distribution](#17-firebase-app-distribution)
18. [TestFlight & App Store](#18-testflight--app-store)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. Prerequisites

### Accounts & Tooling

| Tool | Purpose |
|---|---|
| [Expo account](https://expo.dev) | EAS builds, OTA updates |
| [Apple Developer account](https://developer.apple.com) | iOS signing, TestFlight, App Store |
| [Firebase project](https://console.firebase.google.com) | FCM push notifications |
| [GitHub](https://github.com) | Source control, Actions CI/CD |
| Node.js 20+ | Local development |
| Xcode 15+ | iOS simulator, signing |

### Install global tooling

```bash
npm install -g expo-cli eas-cli
```

---

## 2. Project Setup

### Create the Expo project

```bash
npx create-expo-app mobile --template tabs
cd mobile
```

### Install all dependencies

```bash
# Core navigation
npx expo install expo-router react-native-screens react-native-safe-area-context \
  react-native-gesture-handler react-native-reanimated

# Storage & auth
npx expo install expo-secure-store @react-native-async-storage/async-storage

# Firebase (push notifications)
npm install @react-native-firebase/app @react-native-firebase/messaging

# Notifications
npx expo install expo-notifications

# UI utilities
npx expo install @expo/vector-icons expo-image expo-status-bar expo-font
```

### package.json scripts

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "build:ios:preview": "eas build --profile preview --platform ios",
    "build:ios:prod": "eas build --profile production --platform ios",
    "build:android:preview": "eas build --profile preview --platform android",
    "submit:ios": "eas submit --platform ios"
  }
}
```

---

## 3. Project Structure

```
mobile/
├── app.json                    # Expo config
├── eas.json                    # EAS build profiles
├── tsconfig.json
├── GoogleService-Info.plist    # Firebase iOS config (secret — never commit)
├── google-services.json        # Firebase Android config (secret — never commit)
├── assets/
│   ├── icon.png                # 1024×1024
│   ├── adaptive-icon.png       # Android adaptive icon foreground
│   ├── splash-icon.png         # Splash screen
│   └── notification-icon.png  # Android notification icon (white on transparent)
├── app/
│   ├── _layout.tsx             # Root layout: AuthGate + ThemeProvider
│   ├── index.tsx               # Splash redirect (auth → tabs, no auth → login)
│   ├── login.tsx               # Login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Bottom tab navigator
│   │   ├── matches.tsx         # Upcoming matches
│   │   ├── predictions.tsx     # Prediction history
│   │   └── leaderboard.tsx     # Leaderboard
│   └── matches/
│       └── [matchId].tsx       # Match detail + prediction form
└── src/
    ├── api/
    │   └── client.ts           # HTTP client with Bearer auth
    ├── auth/
    │   └── AuthContext.tsx     # JWT state, signIn/signOut
    ├── notifications/
    │   └── push.ts             # FCM registration lifecycle
    ├── hooks/
    │   ├── useRemoteData.ts    # Generic fetch hook
    │   ├── useMatches.ts
    │   ├── usePredictions.ts
    │   ├── useLeaderboard.ts
    │   └── useAccuracyStats.ts
    ├── components/
    │   ├── ui.tsx              # Card, Button, Input, Badge, Muted
    │   ├── PredictionCard.tsx
    │   ├── LeaderboardRow.tsx
    │   ├── TeamColumn.tsx
    │   └── PeriodFilterBar.tsx
    ├── theme/
    │   ├── colors.ts           # Design tokens
    │   └── theme.tsx           # useTheme hook
    ├── types/
    │   └── api.ts              # API response shapes
    └── utils/
        ├── format.ts           # formatKickoff, isMatchLocked
        └── leaderboard-dates.ts
```

---

## 4. Environment & Configuration

### app.json

```json
{
  "expo": {
    "name": "Football Predictions",
    "slug": "football-predictions",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "footballpredictions",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0f172a"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.yourorg.footballpredictions",
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      },
      "googleServicesFile": "./google-services.json",
      "permissions": ["android.permission.POST_NOTIFICATIONS", "android.permission.INTERNET"],
      "package": "com.yourorg.footballpredictions"
    },
    "plugins": [
      "expo-router",
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#10b981",
          "defaultChannel": "default",
          "sounds": []
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "apiBaseUrl": "https://your-app.vercel.app",
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    }
  }
}
```

> Replace `com.yourorg.footballpredictions`, `your-app.vercel.app`, and `YOUR_EAS_PROJECT_ID`.

### eas.json

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "buildConfiguration": "Release",
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@apple.id",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

---

## 5. Authentication

The backend exposes a dedicated JWT-based auth endpoint for mobile (separate from NextAuth used by the web app).

### Login endpoint

```
POST /api/mobile/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "secret" }

→ 200 { "token": "<jwt>", "user": { "id": "...", "name": "...", "email": "...", "role": "user" } }
→ 401 { "error": "Invalid credentials" }
```

### AuthContext (`src/auth/AuthContext.tsx`)

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'fp_token';
const USER_KEY = 'fp_user';

type AuthUser = { id: string; name: string; email: string; role: string };
type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const storedUser = await SecureStore.getItemAsync(USER_KEY);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
      setIsLoading(false);
    })();
  }, []);

  async function signIn(email: string, password: string) {
    const apiBase = process.env.EXPO_PUBLIC_API_URL ?? 'https://your-app.vercel.app';
    const res = await fetch(`${apiBase}/api/mobile/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Login failed');
    }
    const { token: jwt, user: me } = await res.json();
    await SecureStore.setItemAsync(TOKEN_KEY, jwt);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(me));
    setToken(jwt);
    setUser(me);
  }

  async function signOut() {
    // Unregister push token first (covered in section 11)
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

### Root layout with AuthGate (`app/_layout.tsx`)

```tsx
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/src/auth/AuthContext';
import { ThemeProvider } from '@/src/theme/theme';

function AuthGate() {
  const { token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'matches';
    if (!token && inAuthGroup) router.replace('/login');
    if (token && segments[0] === 'login') router.replace('/(tabs)/matches');
  }, [token, isLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  );
}
```

### Login screen (`app/login.tsx`)

```tsx
import { useState } from 'react';
import { View, TextInput, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '@/src/auth/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (e: any) {
      Alert.alert('Login failed', e.message ?? 'Try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Football Predictions</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0f172a' },
  title: { fontSize: 28, fontWeight: '700', color: '#f1f5f9', marginBottom: 32, textAlign: 'center' },
  input: { backgroundColor: '#1e293b', color: '#f1f5f9', borderRadius: 8, padding: 14, marginBottom: 12 },
  button: { backgroundColor: '#10b981', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
```

---

## 6. API Client

### `src/api/client.ts`

```ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'fp_token';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://your-app.vercel.app';

async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired — clear storage and let AuthGate redirect to login
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
```

---

## 7. Navigation

### Tab navigator (`app/(tabs)/_layout.tsx`)

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color, size }) => <Ionicons name="football-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'Predictions',
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

---

## 8. Screens

### Matches screen (`app/(tabs)/matches.tsx`)

```tsx
import { FlatList, RefreshControl, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useMatches } from '@/src/hooks/useMatches';
import { useTheme } from '@/src/theme/theme';
import { formatKickoff } from '@/src/utils/format';
import type { MatchListItem } from '@/src/types/api';

export default function MatchesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: matches, isLoading, isRefreshing, refresh } = useMatches();

  return (
    <FlatList
      data={matches}
      keyExtractor={(m) => m.id}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item: match }) => (
        <TouchableOpacity
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
          }}
          onPress={() => router.push(`/matches/${match.id}`)}
        >
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
            {formatKickoff(match.kickoffTime)}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{match.homeTeam}</Text>
            <Text style={{ color: colors.primary, fontWeight: '700', marginHorizontal: 12 }}>
              {match.status === 'FINISHED'
                ? `${match.homeScore} – ${match.awayScore}`
                : 'vs'}
            </Text>
            <Text style={{ color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right' }}>
              {match.awayTeam}
            </Text>
          </View>
          {match.userPrediction && (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
              Your prediction: {match.userPrediction.homeScore} – {match.userPrediction.awayScore}
            </Text>
          )}
        </TouchableOpacity>
      )}
    />
  );
}
```

### Match detail & prediction (`app/matches/[matchId].tsx`)

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '@/src/api/client';
import { useTheme } from '@/src/theme/theme';
import { isMatchLocked } from '@/src/utils/format';

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [saving, setSaving] = useState(false);

  async function savePrediction() {
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      Alert.alert('Invalid scores', 'Enter valid non-negative numbers');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/mobile/predictions', {
        method: 'POST',
        body: JSON.stringify({ matchId, homeScore: h, awayScore: a }),
      });
      Alert.alert('Saved!', 'Your prediction was recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 24 }}>
        Your Prediction
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: colors.surface, color: colors.text, borderRadius: 8, padding: 14, fontSize: 24, textAlign: 'center' }}
          keyboardType="number-pad"
          maxLength={2}
          value={home}
          onChangeText={setHome}
          placeholder="0"
          placeholderTextColor={colors.muted}
        />
        <Text style={{ color: colors.muted, fontSize: 20 }}>–</Text>
        <TextInput
          style={{ flex: 1, backgroundColor: colors.surface, color: colors.text, borderRadius: 8, padding: 14, fontSize: 24, textAlign: 'center' }}
          keyboardType="number-pad"
          maxLength={2}
          value={away}
          onChangeText={setAway}
          placeholder="0"
          placeholderTextColor={colors.muted}
        />
      </View>
      <TouchableOpacity
        style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 }}
        onPress={savePrediction}
        disabled={saving}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
          {saving ? 'Saving…' : 'Save Prediction'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

### Leaderboard screen (`app/(tabs)/leaderboard.tsx`)

Key features: period filter (week / month / all-time), group filter, league filter.

```tsx
import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useLeaderboard } from '@/src/hooks/useLeaderboard';
import { PeriodFilterBar } from '@/src/components/PeriodFilterBar';
import { LeaderboardRow } from '@/src/components/LeaderboardRow';
import { useTheme } from '@/src/theme/theme';

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const { data, isRefreshing, refresh } = useLeaderboard(period);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PeriodFilterBar selected={period} onChange={setPeriod} />
      <FlatList
        data={data}
        keyExtractor={(e) => e.userId}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderItem={({ item, index }) => <LeaderboardRow entry={item} rank={index + 1} />}
      />
    </View>
  );
}
```

---

## 9. Data Hooks

### Generic remote data hook (`src/hooks/useRemoteData.ts`)

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

type State<T> = {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
};

export function useRemoteData<T>(fetchFn: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<State<T>>({ data: null, isLoading: true, isRefreshing: false, error: null });
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (refreshing = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState((s) => ({ ...s, isLoading: !refreshing, isRefreshing: refreshing, error: null }));
    try {
      const data = await fetchFn(ctrl.signal);
      if (!ctrl.signal.aborted) setState({ data, isLoading: false, isRefreshing: false, error: null });
    } catch (e: any) {
      if (!ctrl.signal.aborted)
        setState((s) => ({ ...s, isLoading: false, isRefreshing: false, error: e.message }));
    }
  }, [fetchFn]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { ...state, refresh: () => load(true) };
}
```

### Matches hook (`src/hooks/useMatches.ts`)

```ts
import { useCallback } from 'react';
import { apiFetch } from '@/src/api/client';
import { useRemoteData } from './useRemoteData';
import type { MatchListItem } from '@/src/types/api';

export function useMatches() {
  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiFetch<MatchListItem[]>('/api/mobile/matches?status=scheduled', { signal }),
    [],
  );
  return useRemoteData(fetcher);
}
```

### Leaderboard hook (`src/hooks/useLeaderboard.ts`)

```ts
import { useCallback } from 'react';
import { apiFetch } from '@/src/api/client';
import { useRemoteData } from './useRemoteData';
import { getWeekBounds, getMonthBounds } from '@/src/utils/leaderboard-dates';
import type { LeaderboardEntry } from '@/src/types/api';

export function useLeaderboard(period: 'week' | 'month' | 'all') {
  const fetcher = useCallback(
    (signal: AbortSignal) => {
      let query = '';
      if (period === 'week') {
        const { from, to } = getWeekBounds();
        query = `?from=${from}&to=${to}`;
      } else if (period === 'month') {
        const { from, to } = getMonthBounds();
        query = `?from=${from}&to=${to}`;
      }
      return apiFetch<LeaderboardEntry[]>(`/api/mobile/leaderboard${query}`, { signal });
    },
    [period],
  );
  return useRemoteData(fetcher);
}
```

### Predictions hook (`src/hooks/usePredictions.ts`)

```ts
import { useCallback } from 'react';
import { apiFetch } from '@/src/api/client';
import { useRemoteData } from './useRemoteData';
import type { PredictionHistoryItem } from '@/src/types/api';

export function usePredictions() {
  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiFetch<PredictionHistoryItem[]>('/api/mobile/predictions', { signal }),
    [],
  );
  return useRemoteData(fetcher);
}
```

---

## 10. Components

### Primitive UI components (`src/components/ui.tsx`)

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/src/theme/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: colors.surface, borderRadius: 12, padding: 16 }, style]}>{children}</View>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.muted, fontSize: 13 }}>{children}</Text>;
}

export function Badge({ label, variant = 'default' }: { label: string; variant?: 'default' | 'success' | 'warning' }) {
  const bg = { default: '#334155', success: '#064e3b', warning: '#7c2d12' }[variant];
  const fg = { default: '#94a3b8', success: '#34d399', warning: '#fb923c' }[variant];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
```

---

## 11. Push Notifications with Firebase

### Firebase project setup

1. Go to [Firebase Console](https://console.firebase.google.com) → Add project.
2. Add an **iOS app** with your bundle ID → download `GoogleService-Info.plist` → place it in the `mobile/` root.
3. Add an **Android app** with your package name → download `google-services.json` → place it in the `mobile/` root.
4. In Firebase Console → Project settings → Cloud Messaging → copy your **Server key** (used by the Next.js backend to send notifications).

> **Never commit `GoogleService-Info.plist` or `google-services.json` to source control.** Add them to `.gitignore` and inject via EAS secrets (see section 14).

### Apple Push Notification key (iOS only)

1. Apple Developer portal → Certificates, Identifiers & Profiles → Keys → Create a new key.
2. Enable **Apple Push Notifications service (APNs)**.
3. Download the `.p8` file → upload it to Firebase Console → Project settings → Cloud Messaging → iOS app → APNs Authentication Key.
4. Note the **Key ID** and your **Team ID** — Firebase needs both.

### Push registration (`src/notifications/push.ts`)

```ts
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiFetch } from '@/src/api/client';

const LAST_TOKEN_KEY = 'fp_last_fcm_token';

// Call once after successful login
export async function registerForPushNotifications(jwt: string) {
  // Request permission
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10b981',
    });
  }

  // Get FCM token
  let fcmToken: string | null = null;
  if (Platform.OS === 'ios') {
    fcmToken = await messaging().getToken();
  } else {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    fcmToken = tokenData.data;
  }

  if (!fcmToken) return;

  // Register with backend
  await apiFetch('/api/mobile/devices', {
    method: 'POST',
    body: JSON.stringify({ fcmToken, platform: Platform.OS }),
  });

  await SecureStore.setItemAsync(LAST_TOKEN_KEY, fcmToken);
}

// Call during signOut
export async function unregisterPushNotifications() {
  const fcmToken = await SecureStore.getItemAsync(LAST_TOKEN_KEY);
  if (!fcmToken) return;
  await apiFetch('/api/mobile/devices', {
    method: 'DELETE',
    body: JSON.stringify({ fcmToken }),
  }).catch(() => {}); // best-effort
  await SecureStore.deleteItemAsync(LAST_TOKEN_KEY);
}
```

### Notification handler (add to `app/_layout.tsx` before the return)

```tsx
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Inside the AuthGate component:
const router = useRouter();
useEffect(() => {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const type = response.notification.request.content.data?.type;
    if (type === 'results') {
      router.push('/(tabs)/predictions');
    } else {
      router.push('/(tabs)/matches');
    }
  });
  return () => sub.remove();
}, []);
```

### Call registration after login

In `AuthContext.signIn`, after storing the token:

```ts
import { registerForPushNotifications } from '@/src/notifications/push';

// after setToken(jwt):
registerForPushNotifications(jwt).catch(console.warn);
```

And in `signOut`:

```ts
import { unregisterPushNotifications } from '@/src/notifications/push';

// before clearing storage:
await unregisterPushNotifications();
```

---

## 12. Theming (Dark / Light Mode)

### Design tokens (`src/theme/colors.ts`)

```ts
export const darkColors = {
  background: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  primary: '#10b981',
  danger: '#ef4444',
};

export const lightColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  primary: '#10b981',
  danger: '#ef4444',
};
```

### Theme context (`src/theme/theme.tsx`)

```tsx
import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors } from './colors';

type ThemeContextValue = { colors: typeof darkColors; isDark: boolean };
const ThemeContext = createContext<ThemeContextValue>({ colors: darkColors, isDark: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  const colors = isDark ? darkColors : lightColors;
  return <ThemeContext.Provider value={{ colors, isDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

---

## 13. TypeScript Types

### `src/types/api.ts`

```ts
export type MatchListItem = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCrest?: string;
  awayTeamCrest?: string;
  kickoffTime: string;       // ISO 8601 UTC
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  userPrediction?: {
    homeScore: number;
    awayScore: number;
    points: number | null;
  };
};

export type PredictionHistoryItem = {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  homeScore: number | null;
  awayScore: number | null;
  predictedHome: number;
  predictedAway: number;
  points: number | null;
  breakdown?: { label: string; points: number }[];
};

export type LeaderboardEntry = {
  userId: string;
  name: string;
  points: number;
  rank: number;
  accuracy: number;
  predictionCount: number;
  badges?: string[];
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type AccuracyStats = {
  totalPoints: number;
  totalPredictions: number;
  exactScores: number;
  correctOutcomes: number;
  accuracy: number;
  currentStreak: number;
  bestLeague?: string;
};
```

---

## 14. EAS Build Setup

### Initialize EAS

```bash
cd mobile
eas init          # Links to your Expo account; generates projectId
eas credentials   # Walk through iOS certificate setup (interactive)
```

### Build a preview IPA

```bash
eas build --profile preview --platform ios
```

EAS will:
1. Prompt you to sign in to your Apple Developer account (first time only).
2. Create / reuse an App ID matching your bundle identifier.
3. Create / reuse an Ad-hoc provisioning profile.
4. Upload a signing certificate.
5. Build in the cloud and return a download URL.

### Inject Firebase config files as EAS secrets

Never commit `GoogleService-Info.plist` or `google-services.json`. Instead:

```bash
# Upload as EAS secrets (binary files)
eas secret:create --scope project --name GOOGLE_SERVICES_PLIST \
  --type file --value ./GoogleService-Info.plist

eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
  --type file --value ./google-services.json
```

Then reference them in `app.json`:

```json
{
  "expo": {
    "ios": {
      "googleServicesFile": "$GOOGLE_SERVICES_PLIST"
    },
    "android": {
      "googleServicesFile": "$GOOGLE_SERVICES_JSON"
    }
  }
}
```

---

## 15. iOS Certificates & Provisioning

EAS can manage certificates automatically (recommended), or you can use manual credentials.

### Automatic (recommended)

```bash
eas credentials --platform ios
# Choose "Expo Go Managed" → EAS handles everything
```

### What EAS manages

| Credential | Where it lives |
|---|---|
| Distribution Certificate (.p12) | Uploaded to Apple & stored in EAS |
| Provisioning Profile | Auto-created on Apple Developer portal |
| Push Notification key (.p8) | Upload separately to Firebase (not EAS) |

### Manual flow (if needed)

1. Apple Developer → Certificates → Create a **iOS Distribution** certificate → download.
2. Export `.p12` via Keychain Access.
3. Create an **App ID** with push notifications enabled.
4. Create an **Ad Hoc** (preview) or **App Store** (production) provisioning profile.
5. Upload to EAS:
   ```bash
   eas credentials --platform ios --profile production
   # Choose "Add new credentials manually"
   ```

---

## 16. GitHub Actions CI/CD

Create these two workflow files:

### `.github/workflows/ios-preview.yml`

```yaml
name: iOS Preview Build

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: mobile/package-lock.json

      - name: Install dependencies
        working-directory: mobile
        run: npm ci --legacy-peer-deps

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build iOS preview
        working-directory: mobile
        run: eas build --profile preview --platform ios --non-interactive --output ./build.ipa

      - name: Upload to Firebase App Distribution
        uses: wzieba/Firebase-Distribution-Github-Action@v1
        with:
          appId: ${{ secrets.FIREBASE_IOS_APP_ID }}
          serviceCredentialsFileContent: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          groups: ios-testers
          file: mobile/build.ipa
          releaseNotes: |
            Branch: ${{ github.ref_name }}
            Commit: ${{ github.sha }}
            Message: ${{ github.event.head_commit.message }}
```

### `.github/workflows/ios-production.yml`

```yaml
name: iOS Production Build & Submit

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-and-submit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: mobile/package-lock.json

      - name: Install dependencies
        working-directory: mobile
        run: npm ci --legacy-peer-deps

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build iOS production IPA
        working-directory: mobile
        run: eas build --profile production --platform ios --non-interactive

      - name: Submit to App Store Connect
        working-directory: mobile
        run: eas submit --platform ios --latest --non-interactive
        env:
          EXPO_APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
```

### Required GitHub secrets

Go to your repo → Settings → Secrets and variables → Actions, and add:

| Secret | How to obtain |
|---|---|
| `EXPO_TOKEN` | expo.dev → Account settings → Access tokens → Create |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase console → Project settings → Service accounts → Generate new private key (paste entire JSON) |
| `FIREBASE_IOS_APP_ID` | Firebase console → Project settings → Your apps → iOS app → App ID (format: `1:XXXXXXXXXX:ios:XXXXXXXXXX`) |
| `APPLE_APP_SPECIFIC_PASSWORD` | appleid.apple.com → Sign-In and Security → App-Specific Passwords |

---

## 17. Firebase App Distribution

Firebase App Distribution lets you send preview builds to testers before App Store review.

### Setup tester groups

1. Firebase console → App Distribution → Testers & Groups.
2. Create a group called `ios-testers`.
3. Add tester email addresses.
4. Testers accept the invite email and install the Firebase App Tester app.

### Manual distribution (one-off)

```bash
# Build first
eas build --profile preview --platform ios --output ./build.ipa

# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Distribute
firebase appdistribution:distribute build.ipa \
  --app YOUR_FIREBASE_IOS_APP_ID \
  --groups ios-testers \
  --release-notes "Manual test build"
```

---

## 18. TestFlight & App Store

### Build a production IPA

```bash
eas build --profile production --platform ios
```

### Submit to App Store Connect

```bash
eas submit --platform ios --latest
```

EAS will prompt for your Apple ID and app-specific password on first run.

### TestFlight rollout

1. App Store Connect → TestFlight → your build will appear after processing (~15 min).
2. Add internal testers (your team) immediately — no review needed.
3. Add external testers → submit for Beta App Review (~24 h).
4. Once approved, testers install via the TestFlight app.

### App Store submission

1. App Store Connect → your app → + Version → fill metadata (screenshots, description).
2. Select the TestFlight build.
3. Submit for Review.

---

## 19. Troubleshooting

### `expo-notifications` returns null token on iOS simulator

Push tokens are not available on the iOS Simulator. Test on a **physical device** or use the preview build distributed via Firebase App Distribution.

### `@react-native-firebase/messaging` crashes on build

Ensure `GoogleService-Info.plist` is present at the project root (not inside `ios/`) **before** the EAS build runs. If using EAS secrets, verify the secret name matches `app.json`.

### EAS build fails: "Missing credentials"

Run `eas credentials --platform ios` locally first to generate and register credentials, then re-trigger the CI build.

### FCM token not delivered on iOS

Check that:
1. The `.p8` APNs key is uploaded in Firebase console → Project settings → Cloud Messaging → iOS app.
2. `UIBackgroundModes: remote-notification` is in `app.json` → `ios.infoPlist`.
3. The device has notification permissions granted.

### Auth 401 after app upgrade

If you rotate `MOBILE_JWT_SECRET` on the server, all existing tokens are invalidated. Handle `SESSION_EXPIRED` errors in the API client (already shown in section 6) to redirect users back to the login screen gracefully.

### EAS build queue is slow

Free Expo accounts share a build queue. Upgrade to EAS Production for priority builds, or use `eas build --local` to build on your Mac (requires Xcode).

---

*Guide based on the production Football Predictions app. API base URL, bundle IDs, and Firebase app IDs must be updated for your specific deployment.*
