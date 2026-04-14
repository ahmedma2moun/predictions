import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/lib/constants';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found', headerShown: true }} />
      <View style={s.container}>
        <Text style={s.title}>Screen not found.</Text>
        <Link href="/" style={s.link}>
          <Text style={s.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title:    { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  link:     { paddingVertical: 10 },
  linkText: { fontSize: 14, color: Colors.primary },
});
