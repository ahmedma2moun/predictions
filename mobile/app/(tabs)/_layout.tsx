import { Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors, font, spacing } from '@/theme/colors';
import { useAuth } from '@/auth/AuthContext';
import { Ionicons } from '@expo/vector-icons';

function HeaderRight() {
  const { user, signOut } = useAuth();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: spacing.md }}>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.foreground, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>
          {user?.name ?? ''}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
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
  return (
    <Text style={{ color: colors.foreground, fontSize: font.size.lg, fontWeight: font.weight.bold }}>
      ⚽ Predictions
    </Text>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
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
          title: 'Matches',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'My Picks',
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaders',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
