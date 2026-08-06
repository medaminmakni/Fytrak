// NOTE: This screen is not currently rendered anywhere — RootNavigator always
// routes trainee profile completion through OnboardingFlow (see
// navigation/RootNavigator.tsx). It's kept in reserve rather than deleted
// because its async-submit/error-toast pattern is solid and may be reused;
// if that's no longer true, delete this file along with this comment.
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import type { CompleteProfilePayload } from "../../services/userSession";
import { toLocalDateKey } from "../../utils/dateKeys";

type CompleteProfileScreenProps = {
  onComplete: (payload: CompleteProfilePayload) => Promise<void>;
};

export function CompleteProfileScreen({ onComplete }: CompleteProfileScreenProps) {
  const [goal, setGoal] = useState("");
  // Basic Stats
  const [weight, setWeight] = useState(75);
  const [height, setHeight] = useState(175);
  const [birthDate, setBirthDate] = useState(new Date(2000, 0, 1));
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canSubmit = useMemo(() =>
    goal.trim().length > 2 &&
    city.trim().length > 1 &&
    weight > 0 &&
    height > 0 &&
    !isSubmitting,
    [goal, weight, height, city, isSubmitting]
  );

  const handleContinue = async () => {
    if (!canSubmit) return;
    try {
      setIsSubmitting(true);
      setErrorText(null);
      await onComplete({
        goal,
        weight,
        height,
        birthday: toLocalDateKey(birthDate),
        city,
        country,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const adjustMetric = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number, min = 0) => {
    setter(prev => Math.max(min, prev + delta));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScreenShell
      title="Personalize"
      subtitle="Just a few basics to get started"
      contentStyle={styles.shellContent}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Section: Basic Info */}
          <SectionTitle title="General stats" icon="person" />
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary Fitness Goal</Text>
              <TextInput
                placeholder="e.g. Lose fat, Build muscle"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={goal}
                onChangeText={setGoal}
              />
            </View>

            <View style={styles.row}>
              <MetricStepper label="Weight (kg)" value={weight} onAdjust={(d) => adjustMetric(setWeight, d)} />
              <MetricStepper label="Height (cm)" value={height} onAdjust={(d) => adjustMetric(setHeight, d)} />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput placeholder="Tunis" placeholderTextColor={colors.textMuted} style={styles.input} value={city} onChangeText={setCity} />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Country</Text>
                <TextInput placeholder="Tunisia" placeholderTextColor={colors.textMuted} style={styles.input} value={country} onChangeText={setCountry} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Birth Date</Text>
              <DateButton date={birthDate} onPress={() => setShowBirthPicker(true)} />
              {showBirthPicker && (
                <DateTimePicker
                  value={birthDate}
                  mode="date"
                  onChange={(e, d) => { setShowBirthPicker(false); if (d) setBirthDate(d); }}
                  maximumDate={new Date()}
                />
              )}
            </View>
          </View>

          <Pressable
            style={[styles.finishBtn, !canSubmit && styles.disabledButton]}
            disabled={!canSubmit || isSubmitting}
            onPress={() => void handleContinue()}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <>
                <Text style={styles.finishBtnText}>START YOUR JOURNEY</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.primaryText} />
              </>
            )}
          </Pressable>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <View style={styles.infoBox}>
            <Ionicons name="lock-closed" size={18} color="#4ade80" />
            <Text style={styles.infoText}>Detailed workout and nutrition questions will follow when you access those sections.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

// Reusable Components to keep UI clean
function SectionTitle({ title, icon }: { title: string, icon: any }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

function MetricStepper({ label, value, onAdjust }: { label: string, value: number, onAdjust: (d: number) => void }) {
  return (
    <View style={[styles.inputGroup, { flex: 1 }]}>
      <Text style={[styles.label, { fontSize: 13 }]}>{label}</Text>
      <View style={styles.stepperContainer}>
        <Pressable style={styles.stepperBtn} onPress={() => onAdjust(-1)}>
          <Ionicons name="remove" size={18} color={colors.primary} />
        </Pressable>
        <Text style={styles.stepperValueText}>{value}</Text>
        <Pressable style={styles.stepperBtn} onPress={() => onAdjust(1)}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function DateButton({ date, onPress }: { date: Date, onPress: () => void }) {
  return (
    <Pressable style={styles.dateSelector} onPress={onPress}>
      <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      <Text style={styles.dateText}>
        {date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shellContent: { paddingBottom: 0 },
  scroll: { paddingBottom: 60, marginTop: 10, gap: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginStart: 8, marginTop: 8 },
  sectionTitleText: { color: colors.primary, fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  card: { backgroundColor: "#161616", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#2c2c2e", gap: 16 },
  inputGroup: { gap: 8 },
  row: { flexDirection: "row", gap: 12 },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: "700", marginStart: 2 },
  input: { backgroundColor: "#1c1c1e", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: "#ffffff", fontSize: 15, fontWeight: "600", borderWidth: 1, borderColor: "#2c2c2e" },
  textArea: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  stepperContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#1c1c1e", borderRadius: 14, borderWidth: 1, borderColor: "#2c2c2e", height: 48, overflow: "hidden" },
  stepperBtn: { width: 40, height: "100%", alignItems: "center", justifyContent: "center" },
  stepperValueText: { flex: 1, color: "#ffffff", fontSize: 16, fontWeight: "800", textAlign: "center" },
  dateSelector: { flexDirection: "row", alignItems: "center", backgroundColor: "#1c1c1e", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderWidth: 1, borderColor: "#2c2c2e" },
  dateText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  levelRow: { flexDirection: "row", gap: 8 },
  levelPill: { flex: 1, backgroundColor: "#1c1c1e", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#2c2c2e" },
  levelPillActive: { borderColor: colors.primary, backgroundColor: "#22251a" },
  levelPillText: { color: colors.textDim, fontWeight: "900", fontSize: 11, textAlign: "center" },
  levelPillTextActive: { color: colors.primary },
  finishBtn: { backgroundColor: colors.primary, borderRadius: 18, height: 62, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 12, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  finishBtnText: { color: colors.primaryText, fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  disabledButton: { opacity: 0.5 },
  errorText: { color: "#ff4444", textAlign: "center", fontSize: 14, fontWeight: "600", marginTop: 10 },
  infoBox: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#161616", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "#2c2c2e", marginTop: 10 },
  infoText: { flex: 1, color: colors.textMuted, fontSize: 13, fontWeight: "500", lineHeight: 18 },
});
