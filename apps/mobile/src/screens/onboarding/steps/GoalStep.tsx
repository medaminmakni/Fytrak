import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { OnboardingHeader } from '../../../components/OnboardingHeader';
import { Typography } from '../../../components/Typography';
import { PrimaryButton } from '../../../components/Button';
import { GoalOption } from '../../../types/onboarding';

interface GoalStepProps {
  onNext: (goal: string) => void;
  onBack: () => void;
}

export function GoalStep({ onNext, onBack }: GoalStepProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const goals: GoalOption[] = [
    { id: 'lose_weight', title: 'Lose Weight', subtitle: 'Burn fat and get leaner with personalized deficit plans.', icon: 'fire', iconType: 'mcm', color: '#FF5722' },
    { id: 'build_muscle', title: 'Build Muscle', subtitle: 'Gain strength and mass with high-intensity training.', icon: 'arm-flex', iconType: 'mcm', color: '#4CAF50' },
    { id: 'get_fit', title: 'Get Fit', subtitle: 'Improve overall health, endurance, and flexibility.', icon: 'heart-pulse', iconType: 'mcm', color: '#E91E63' },
    { id: 'athletic_performance', title: 'Performance', subtitle: 'Maximize speed, agility, and elite athletic power.', icon: 'flash', iconType: 'ionicons', color: colors.primary },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader onBack={onBack} progress={80} />
      <View style={styles.content}>
        <Typography variant="h1">What's your goal?</Typography>
        <Typography variant="subtitle" style={styles.sub}>Select your primary focus so we can tailor your experience.</Typography>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {goals.map((g) => (
            <Pressable
              key={g.id}
              style={[styles.card, selected === g.id && { borderColor: g.color, backgroundColor: '#0F0F0F' }]}
              onPress={() => setSelected(g.id)}
            >
              <View style={[styles.iBox, { backgroundColor: g.color + '15' }]}>
                {g.iconType === 'ionicons' ? <Ionicons name={g.icon as any} size={26} color={g.color} /> : <MaterialCommunityIcons name={g.icon as any} size={26} color={g.color} />}
              </View>
              <View style={styles.infoCol}>
                <Typography variant="h2" color={selected === g.id ? g.color : '#fff'}>{g.title}</Typography>
                <Typography variant="subtitle" style={styles.cardSub}>{g.subtitle}</Typography>
              </View>
              <View style={[styles.ring, selected === g.id && { borderColor: g.color }]}>{selected === g.id && <View style={[styles.dot, { backgroundColor: g.color }]} />}</View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <PrimaryButton title="Confirm Goal" icon="arrow-forward" disabled={!selected} onPress={() => selected && onNext(selected)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 10 },
  sub: { marginTop: 8 },
  scroll: { flex: 1, marginTop: 20 },
  scrollContent: { gap: 12, paddingBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161616', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#333', gap: 12 },
  iBox: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  infoCol: { flex: 1 },
  cardSub: { fontSize: 12, color: colors.textDim, marginTop: 2, fontWeight: '600', lineHeight: 16 },
  ring: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#222', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  footer: { paddingHorizontal: 24, paddingBottom: 30 },
});
