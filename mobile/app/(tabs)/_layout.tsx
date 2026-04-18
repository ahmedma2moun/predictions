import { Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { font, spacing } from '@/theme/colors';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';

function HeaderRight() {
  const { user, signOut } = useAuth();
  const { colors, mode, toggle } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingRight: spacing.md,
      }}
    >
      <Pressable
        onPress={toggle}
        hitSlop={10}
        accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
      >
        <Ionicons
          name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
          size={20}
          color={colors.foreground}
        />
      </Pressable>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: font.size.xs,
            fontWeight: font.weight.semibold,
          }}
        >
          {user?.name ?? ''}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: font.size.xxs }}>
          {user?.role === 'admin' ? 'Admin' : 'Player'}
        </Text>
      </View>
      <Pressable
        onPress={signOut}
        hitSlop={10}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
      >
        <Ionicons name="log-out-outline" size={22} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

function HeaderTitle() {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.foreground,
        fontSize: font.size.lg,
        fontWeight: font.weight.bold,
      }}
    >
      ⚽ Predictions
    </Text>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const isAdmin = user?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card, borderBottomColor: colors.border },
        headerTintColor: colors.foreground,
        headerTitle: HeaderTitle,
        headerRight: HeaderRight,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: font.size.xs, fontWeight: font.weight.medium },
      }}
    >
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Upcoming Matches',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'My Score',
          href: isAdmin ? null : undefined,
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
    </Tabs>
  );
}
