import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '@/theme/colors';

export default function PredictionsScreen() {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>My Predictions</Text>
      <Text style={styles.subtitle}>Coming in Phase 2.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    color: colors.foreground,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
  },
  subtitle: { color: colors.mutedForeground, fontSize: font.size.sm },
});
