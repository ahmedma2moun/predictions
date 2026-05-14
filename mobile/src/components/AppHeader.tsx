import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/theme';
import { font, radius, spacing } from '@/theme/colors';

interface Props {
  title: string;
  subtitle?: string;
}

export function AppHeader({ title, subtitle }: Props) {
  const { colors, mode, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          backgroundColor: colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.titleBlock}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 26,
            fontWeight: font.weight.bold,
            letterSpacing: -0.6,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.mutedForeground, fontSize: font.size.sm, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={toggle}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.cardElevated, opacity: pressed ? 0.6 : 1 }]}
          accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Ionicons
            name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
            size={17}
            color={colors.foreground}
          />
        </Pressable>
        <Pressable
          onPress={signOut}
          hitSlop={10}
          style={({ pressed }) => [
            styles.avatar,
            { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftBorder, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityLabel="Sign out"
        >
          <Text style={{ color: colors.primary, fontSize: font.size.xs, fontWeight: font.weight.bold }}>
            {initials}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 0 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
