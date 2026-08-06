import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { spacing, radius } from "../../../theme/tokens";
import { SectionTitle } from "../../../components/SectionTitle";
import { MetricStepper } from "../../../components/MetricStepper";

type NutritionIntakeFormProps = {
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
};

export function NutritionIntakeForm({ onSave, isSaving }: NutritionIntakeFormProps) {
  const [activityLevel, setActivityLevel] = useState("Moderate");
  const [allergies, setAllergies] = useState("");
  const [meds, setMeds] = useState("");
  const [smoker, setSmoker] = useState(false);
  const [cigs, setCigs] = useState(0);
  const [coffee, setCoffee] = useState(1);
  const [alcohol, setAlcohol] = useState(0);
  const [sleep, setSleep] = useState(7);
  const [dishes, setDishes] = useState("");
  const [supps, setSupps] = useState("");
  const [bedtime, setBedtime] = useState(new Date(new Date().setHours(23, 0, 0)));
  const [wakeUpTime, setWakeUpTime] = useState(new Date(new Date().setHours(7, 0, 0)));
  const [showBedtimePicker, setShowBedtimePicker] = useState(false);
  const [showWakeUpPicker, setShowWakeUpPicker] = useState(false);

  const handleComplete = async () => {
    const data = {
      activityLevel,
      medical: { allergies: allergies.trim() || "None", medications: meds.trim() || "None" },
      lifestyle: {
        smoker,
        cigarettesPerDay: Number(cigs),
        coffeePerDay: Number(coffee),
        alcoholPerDay: Number(alcohol),
        sleepHours: Number(sleep),
        sleepTiming: `${bedtime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${wakeUpTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      },
      nutrition: { specificDishes: dishes.trim() || "No specific preferences", supplements: supps.trim() || "None", regularEating: true }
    };
    await onSave(data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.formCard}>
        <SectionTitle title="Lifestyle" icon="body" />
        <Text style={styles.label}>Daily Activity Level</Text>
        <View style={styles.groupRow}>
          {["Sedentary", "Moderate", "Active"].map(l => (
            <Pressable key={l} style={[styles.pill, activityLevel === l && styles.pillActive]} onPress={() => setActivityLevel(l)}>
              <Text style={[styles.pillText, activityLevel === l && styles.pillTextActive]}>{l.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <MetricStepper label="Coffee / Day" value={coffee} onAdjust={(d) => setCoffee(Math.max(0, coffee + d))} />
          <MetricStepper label="Sleep (hrs)" value={sleep} onAdjust={(d) => setSleep(Math.max(2, sleep + d))} />
        </View>

        <SectionTitle title="Medical" icon="medkit" />
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Food Allergies</Text>
          <TextInput style={styles.input} placeholderTextColor={colors.textFaint} value={allergies} onChangeText={setAllergies} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Medications / Supplements</Text>
          <TextInput style={styles.input} placeholderTextColor={colors.textFaint} value={supps} onChangeText={setSupps} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bedtime & Wake-up</Text>
          <View style={styles.row}>
            <Pressable style={[styles.input, { flex: 1 }]} onPress={() => setShowBedtimePicker(true)}>
              <Text style={styles.timeText}>{bedtime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={styles.miniLabel}>BEDTIME</Text>
            </Pressable>
            <Pressable style={[styles.input, { flex: 1 }]} onPress={() => setShowWakeUpPicker(true)}>
              <Text style={styles.timeText}>{wakeUpTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={styles.miniLabel}>WAKE-UP</Text>
            </Pressable>
          </View>
          {showBedtimePicker && <DateTimePicker value={bedtime} mode="time" display="spinner" onChange={(_, d) => { setShowBedtimePicker(false); if (d) setBedtime(d); }} />}
          {showWakeUpPicker && <DateTimePicker value={wakeUpTime} mode="time" display="spinner" onChange={(_, d) => { setShowWakeUpPicker(false); if (d) setWakeUpTime(d); }} />}
        </View>

        <SectionTitle title="Habits" icon="cafe" />
        <View style={styles.row}>
          <Pressable style={[styles.pill, smoker && styles.pillActive]} onPress={() => setSmoker(!smoker)}>
            <Text style={[styles.pillText, smoker && styles.pillTextActive]}>{smoker ? "SMOKER: YES" : "SMOKER: NO"}</Text>
          </Pressable>
          {smoker && <MetricStepper label="Cigs / Day" value={cigs} onAdjust={(d) => setCigs(Math.max(1, cigs + d))} />}
        </View>

        <SectionTitle title="Preferences" icon="restaurant" />
        <View style={styles.inputGroup}>
          <TextInput style={styles.input} placeholder="Favorite dishes or preferences..." placeholderTextColor={colors.textFaint} value={dishes} onChangeText={setDishes} />
        </View>

        <Pressable style={styles.saveBtn} onPress={handleComplete} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.saveBtnText}>COMPLETE NUTRITION PROFILE</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xl, gap: spacing.md },
  formCard: { backgroundColor: colors.bgElevated, borderRadius: radius["2xl"], padding: spacing.xl, borderWidth: 1, borderColor: colors.borderStrong, gap: spacing.xl },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "900", letterSpacing: 0.5, marginBottom: spacing.xs },
  groupRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  pill: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderSubtle },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.textSecondary, fontSize: 11, fontWeight: "900" },
  pillTextActive: { color: colors.primaryText },
  inputGroup: { gap: spacing.xxs },
  input: { height: 56, backgroundColor: colors.bgDark, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center", borderWidth: 1, borderColor: colors.borderSubtle, color: colors.text },
  timeText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  miniLabel: { color: colors.textFaint, fontSize: 11, fontWeight: "900", marginTop: 2 },
  saveBtn: { height: 60, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  saveBtnText: { color: colors.primaryText, fontSize: 14, fontWeight: "900" },
});
