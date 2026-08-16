import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors } from "../../../theme/colors";
import { radius, spacing, typography } from "../../../theme/tokens";
import { SectionTitle } from "../../../components/SectionTitle";
import { MetricStepper } from "../../../components/MetricStepper";
import { ToastService } from "../../../components/Toast";
import { auth } from "../../../config/firebase";
import { saveWorkoutIntake } from "../../../services/userSession";
import { toLocalDateKey } from "../../../utils/dateKeys";
import type { ProfileLevel } from "../../../types/domain";

type WorkoutIntakeViewProps = {
  onComplete: () => void;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

export function WorkoutIntakeView({ onComplete }: WorkoutIntakeViewProps) {
  const [level, setLevel] = useState<ProfileLevel>("Beginner");
  const [lastTrainedDate, setLastTrainedDate] = useState(new Date());
  const [trainingExp, setTrainingExp] = useState("");
  const [flexibility, setFlexibility] = useState(5);
  const [injuries, setInjuries] = useState("");
  const [healthIssues, setHealthIssues] = useState("");
  const [workStress, setWorkStress] = useState(5);
  const [workToughness, setWorkToughness] = useState(5);
  const [workStart, setWorkStart] = useState(new Date(new Date().setHours(9, 0, 0)));
  const [workEnd, setWorkEnd] = useState(new Date(new Date().setHours(17, 0, 0)));
  const [isRotatingShift, setIsRotatingShift] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWorkStartPicker, setShowWorkStartPicker] = useState(false);
  const [showWorkEndPicker, setShowWorkEndPicker] = useState(false);

  const handleSaveIntake = async () => {
    if (!auth.currentUser) return;
    try {
      setIsSaving(true);
      await saveWorkoutIntake(auth.currentUser.uid, {
        level,
        lastTrainedDate: toLocalDateKey(lastTrainedDate),
        trainingExperience: trainingExp.trim() || "None",
        flexibility,
        injuries: injuries.trim() || "None",
        healthIssues: healthIssues.trim() || "None",
        work: {
          stress: Number(workStress),
          toughness: Number(workToughness),
          timing: `${workStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${workEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | ${isRotatingShift ? "Rotating" : "Fixed"}`
        }
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch (e) {
      ToastService.error("Error", "Failed to save details.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.onboardCard}>
        <SectionTitle title="Experience" icon="fitness" />
        <View style={styles.groupRow}>
          {(["Beginner", "Intermediate", "Advanced"] as const).map((item) => (
            <Pressable
              key={item}
              style={[styles.pill, level === item && styles.pillActive]}
              onPress={() => setLevel(item)}
            >
              <Text style={[styles.pillText, level === item && styles.pillTextActive]}>
                {item.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Training Months?</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={colors.textMuted}
            value={trainingExp}
            onChangeText={setTrainingExp}
          />
        </View>

        <SectionTitle title="Health" icon="medkit" />
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Injuries?</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={colors.textMuted}
            value={injuries}
            onChangeText={setInjuries}
          />
        </View>
        <View style={styles.row}>
          <MetricStepper
            label="Flexibility (1-10)"
            value={flexibility}
            onAdjust={(delta: number) =>
              setFlexibility(clamp(flexibility + delta, 1, 10))
            }
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Last Session?</Text>
          <Pressable
            style={styles.dateInput}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>{lastTrainedDate.toDateString()}</Text>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={lastTrainedDate}
              mode="date"
              display="spinner"
              onChange={(_: unknown, date?: Date) => {
                setShowDatePicker(false);
                if (date) setLastTrainedDate(date);
              }}
            />
          )}
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Medical / Postures</Text>
          <TextInput
            style={[styles.input, styles.multiLineInput]}
            multiline
            placeholder="Describe any issues..."
            placeholderTextColor={colors.textMuted}
            value={healthIssues}
            onChangeText={setHealthIssues}
          />
        </View>

        <SectionTitle title="Work life" icon="briefcase" />
        <View style={styles.inputGroup}>
          <View style={styles.row}>
            <TimeInput
              label="START"
              date={workStart}
              onPress={() => setShowWorkStartPicker(true)}
            />
            <TimeInput
              label="END"
              date={workEnd}
              onPress={() => setShowWorkEndPicker(true)}
            />
          </View>
          {showWorkStartPicker && (
            <DateTimePicker
              value={workStart}
              mode="time"
              display="spinner"
              onChange={(_: unknown, date?: Date) => {
                setShowWorkStartPicker(false);
                if (date) setWorkStart(date);
              }}
            />
          )}
          {showWorkEndPicker && (
            <DateTimePicker
              value={workEnd}
              mode="time"
              display="spinner"
              onChange={(_: unknown, date?: Date) => {
                setShowWorkEndPicker(false);
                if (date) setWorkEnd(date);
              }}
            />
          )}
        </View>
        <View style={styles.row}>
          <MetricStepper
            label="Work Stress"
            value={workStress}
            onAdjust={(delta: number) =>
              setWorkStress(clamp(workStress + delta, 1, 10))
            }
          />
          <MetricStepper
            label="Physicality"
            value={workToughness}
            onAdjust={(delta: number) =>
              setWorkToughness(clamp(workToughness + delta, 1, 10))
            }
          />
        </View>
        <Pressable style={styles.finishBtn} onPress={handleSaveIntake} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.finishBtnText}>START TRAINING</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

type TimeInputProps = {
  label: string;
  date: Date;
  onPress: () => void;
};

function TimeInput({ label, date, onPress }: TimeInputProps) {
  return (
    <Pressable style={styles.timeLink} onPress={onPress}>
      <Text style={styles.timeValue}>
        {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
      <Text style={styles.timerLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 220, gap: spacing.lg },
  onboardCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.lg,
  },
  groupRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  pill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.textMuted, fontSize: 11, fontWeight: "900" },
  pillTextActive: { color: "#000" },
  inputGroup: { gap: 4, marginBottom: 12 },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: "600", marginBottom: 4 },
  input: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 14,
    padding: 14,
    color: "#fff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  multiLineInput: { height: 80 },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  dateInput: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  dateText: { color: "#fff" },
  timeLink: {
    flex: 1,
    padding: 12,
    backgroundColor: colors.surfaceInset,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  timeValue: { color: "#fff", fontSize: 13 },
  timerLabel: { color: colors.textDim, fontSize: 11, fontWeight: "900" },
  finishBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  finishBtnText: { color: colors.primaryText, ...typography.button, fontSize: 16 },
});
