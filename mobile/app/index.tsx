import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/theme';

export default function Index() {
  const { token, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return token ? <Redirect href="/(tabs)/matches" /> : <Redirect href="/login" />;
}
