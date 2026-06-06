import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { font } from '@/theme/colors';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { OddsExplainerModal } from '@/components/OddsExplainerModal';

export default function TabsLayout() {
  const { user } = useAuth();
  const { colors, mode } = useTheme();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <>
    <OddsExplainerModal />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: mode === 'light' ? 'rgba(244,246,250,0.90)' : 'rgba(10,12,18,0.86)',
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          height: 78,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={24}
            tint={mode === 'light' ? 'light' : 'dark'}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: font.size.xs, fontWeight: font.weight.medium },
      }}
    >
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'My Score',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="seasons"
        options={{
          title: 'Seasons',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
    </>
  );
}
