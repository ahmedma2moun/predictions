import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/lib/constants';

// Initial route required by Expo Router.
// The root _layout.tsx handles auth-based redirection to /(tabs) or /login.
export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}
