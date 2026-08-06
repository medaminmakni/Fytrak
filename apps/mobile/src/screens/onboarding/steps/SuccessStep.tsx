import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { Typography } from '../../../components/Typography';
import { PrimaryButton } from '../../../components/Button';
import { CalculatedPlan } from '../../../utils/calculators';

const { width } = Dimensions.get('window');

interface SuccessStepProps {
  plan: CalculatedPlan;
  onFinish: () => void;
  isSaving?: boolean;
}

export function SuccessStep({ plan, onFinish, isSaving }: SuccessStepProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 8, useNativeDriver: true })
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideUp }] }]}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark-sharp" size={40} color={colors.primary} />
          </View>
          <Typography variant="h1" style={styles.title}>All Set!</Typography>
          <Typography variant="subtitle" style={styles.subtitle}>
            Your personalized Fytrak plan is ready.
          </Typography>
        </Animated.View>

        <View style={styles.planCard}>
          <Typography variant="label" color={colors.primary}>DAILY TARGET</Typography>
          <View style={styles.calorieRow}>
            <Typography style={styles.calNumber}>{plan.calories}</Typography>
            <Typography variant="h2" style={styles.calLabel}>KCAL</Typography>
          </View>

          <View style={styles.macroGrid}>
            <MacroBox label="PROTEIN" value={plan.protein} unit="G" icon="flash" color="#4ade80" />
            <MacroBox label="CARBS" value={plan.carbs} unit="G" icon="restaurant" color="#60a5fa" />
            <MacroBox label="FATS" value={plan.fats} unit="G" icon="water" color="#fbbf24" />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.iconFaint} />
          <Typography variant="subtitle" style={styles.infoText}>
            These targets are calculated based on your BMR ({plan.bmr} kcal) and activity level.
          </Typography>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title={isSaving ? "Saving..." : "Enter Dashboard"}
          icon={isSaving ? undefined : "rocket"}
          onPress={onFinish}
          disabled={isSaving}
        />
      </View>
    </SafeAreaView>
  );
}

function MacroBox({ label, value, unit, icon, color }: any) {
  return (
    <View style={styles.macroBox}>
      <Ionicons name={icon} size={16} color={color} />
      <Typography variant="h2" style={styles.macroValue}>{value}{unit}</Typography>
      <Typography variant="label" color={colors.textDim} style={styles.macroLabel}>{label}</Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  checkCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a1a10', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary, marginBottom: 20 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: 8 },
  planCard: { width: '100%', backgroundColor: '#161616', borderRadius: 24, padding: 30, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  calorieRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginVertical: 15 },
  calNumber: { fontSize: 64, fontWeight: '900', color: '#fff' },
  calLabel: { marginBottom: 12 },
  macroGrid: { flexDirection: 'row', width: '100%', gap: 12, marginTop: 10 },
  macroBox: { flex: 1, backgroundColor: '#000', borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  macroValue: { fontSize: 18, marginTop: 4 },
  macroLabel: { marginTop: 2, fontSize: 11 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginTop: 30 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  footer: { padding: 24, paddingBottom: 40, width: '100%' },
});
