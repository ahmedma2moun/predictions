import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/lib/constants';
import { getUser, clearAuth, User } from '@/lib/auth';
import { unregisterNotifications } from '@/lib/notifications';

export default function AccountScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await unregisterNotifications().catch(() => {});
            await clearAuth();
            router.replace('/login');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={s.screen}>
      {/* Avatar + name */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {user?.name ? user.name.slice(0, 2).toUpperCase() : '??'}
          </Text>
        </View>
        <Text style={s.name}>{user?.name ?? '—'}</Text>
        <Text style={s.email}>{user?.email ?? '—'}</Text>
        {user?.role === 'admin' && (
          <View style={s.adminBadge}>
            <Text style={s.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={s.section}>
        <TouchableOpacity
          style={[s.row, s.destructiveRow]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.7}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={Colors.destructive} />
          ) : (
            <Ionicons name="log-out-outline" size={20} color={Colors.destructive} />
          )}
          <Text style={s.destructiveText}>
            {loggingOut ? 'Logging out…' : 'Log Out'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, padding: 20 },

  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: Colors.textMuted },
  name:        { fontSize: 20, fontWeight: '700', color: Colors.text },
  email:       { fontSize: 13, color: Colors.textMuted },
  adminBadge:  {
    marginTop: 4,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.bg },

  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  destructiveRow: {},
  destructiveText: { fontSize: 15, fontWeight: '600', color: Colors.destructive },
});
