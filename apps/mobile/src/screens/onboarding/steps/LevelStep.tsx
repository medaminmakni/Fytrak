import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { OnboardingHeader } from '../../../components/OnboardingHeader';
import { Typography } from '../../../components/Typography';
import { PrimaryButton } from '../../../components/Button';
import { LevelOption } from '../../../types/onboarding';

interface LevelStepProps {
  onNext: (level: string) => void;
  onBack: () => void;
}

export function LevelStep({ onNext, onBack }: LevelStepProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const levels: LevelOption[] = [
    { id: 'beginner', title: 'Beginner', subtitle: 'Starting fresh', description: 'New to consistent training. Focusing on form and basic movements.', icon: 'leaf', intensity: 1 },
    { id: 'intermediate', title: 'Intermediate', subtitle: 'Consistent trainee', description: 'Used to regular training. Looking for progressive overload.', icon: 'barbell', intensity: 2 },
    { id: 'advanced', title: 'Advanced', subtitle: 'Elite athlete', description: 'Maximum intensity. Pushing to the limits of strength.', icon: 'flash', intensity: 3 },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader onBack={onBack} progress={100} />
      <View style={styles.content}>
        <Typography variant="h1">Your Level</Typography>
        <Typography variant="subtitle" style={styles.sub}>Be honest! It help us select the best starting programs for you.</Typography>

        <View style={styles.list}>
          {levels.map((l) => (
            <Pressable
              key={l.id}
              style={[styles.card, selected === l.id && styles.cardActive]}
              onPress={() => setSelected(l.id)}
            >
              <View style={styles.row}>
                <View style={[styles.iBox, selected === l.id && { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name={l.icon as any} size={24} color={selected === l.id ? colors.primary : colors.iconFaint} />
                </View>
                <View style={styles.info}>
                  <Typography variant="h2" color={selected === l.id ? colors.primary : '#fff'}>{l.title}</Typography>
                  <Typography variant="label" color={colors.textDim}>{l.subtitle}</Typography>
                </View>
                <View style={styles.bars}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <View key={i} style={[styles.bar, i < l.intensity && { backgroundColor: selected === l.id ? colors.primary : '#333' }]} />
                  ))}
                </View>
              </View>
              <Typography variant="subtitle" style={styles.desc}>{l.description}</Typography>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <PrimaryButton title="Finalize Profile" icon="rocket" disabled={!selected} onPress={() => selected && onNext(selected)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 10 },
  sub: { marginTop: 5 },
  list: { marginTop: 40, gap: 16 },
  card: { backgroundColor: '#161616', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#333' },
  cardActive: { backgroundColor: '#1a1a10', borderColor: colors.primary, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iBox: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#161616', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { width: 10, height: 4, borderRadius: 2, backgroundColor: '#161616' },
  desc: { marginTop: 15, lineHeight: 18, fontSize: 13, color: colors.textMuted },
  footer: { padding: 24, paddingBottom: 40 },
});
