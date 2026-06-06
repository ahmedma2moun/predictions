import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing, type Palette } from '@/theme/colors';
import { useTheme } from '@/theme/theme';

const STORAGE_KEY = 'odds_explainer_v1_seen';

const STEPS = [
  {
    emoji: '🔮',
    title: 'Pick your outcome',
    desc: 'Choose who wins (or a draw) like you always have — nothing changes here.',
  },
  {
    emoji: '⚡',
    title: 'Bold picks earn bonus points',
    desc: 'Once the match is done, your score is multiplied based on how many people made the same pick. Rare correct predictions earn more.',
  },
  {
    emoji: '🏆',
    title: 'Multiplier revealed after the match',
    desc: "You won't see the odds until the match is locked and results are in — everyone finds out at the same time.",
  },
];

export function OddsExplainerModal() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (!val) setVisible(true);
    });
  }, []);

  async function handleClose() {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🎯</Text>
            <Text style={styles.title}>Predictions just got more exciting</Text>
            <Text style={styles.intro}>
              Your predictions now earn{' '}
              <Text style={styles.bold}>bonus points</Text> based on how bold your pick was.
            </Text>
          </View>

          <View style={styles.steps}>
            {STEPS.map((step) => (
              <View key={step.title} style={styles.step}>
                <Text style={styles.stepEmoji}>{step.emoji}</Text>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.example}>
            <Text style={styles.exampleLabel}>Example</Text>
            <Text style={styles.exampleText}>
              8 out of 10 players picked a home win — only you and one friend picked the away
              team. The away team wins. Your base score of 10 pts becomes{' '}
              <Text style={styles.bold}>25 pts</Text> with a 2.5× multiplier. 🎉
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleClose}
          >
            <Text style={styles.buttonText}>Got it, let's play!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    sheet: {
      backgroundColor: c.card,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.xl,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 360,
      gap: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 20,
    },
    header: {
      gap: spacing.xs,
    },
    headerEmoji: {
      fontSize: 28,
      marginBottom: spacing.xs,
    },
    title: {
      color: c.foreground,
      fontSize: font.size.md,
      fontWeight: font.weight.bold,
      lineHeight: 22,
    },
    intro: {
      color: c.mutedForeground,
      fontSize: font.size.sm,
      lineHeight: 20,
    },
    bold: {
      color: c.foreground,
      fontWeight: font.weight.semibold,
    },
    steps: {
      gap: spacing.sm,
    },
    step: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    stepEmoji: {
      fontSize: 18,
      lineHeight: 22,
      marginTop: 1,
    },
    stepBody: {
      flex: 1,
      gap: 3,
    },
    stepTitle: {
      color: c.foreground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
    },
    stepDesc: {
      color: c.mutedForeground,
      fontSize: font.size.xs,
      lineHeight: 17,
    },
    example: {
      backgroundColor: c.accent,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    exampleLabel: {
      color: c.foreground,
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
    },
    exampleText: {
      color: c.mutedForeground,
      fontSize: font.size.xs,
      lineHeight: 17,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    buttonPressed: {
      opacity: 0.8,
    },
    buttonText: {
      color: c.primaryForeground,
      fontSize: font.size.sm,
      fontWeight: font.weight.semibold,
    },
  });
}
