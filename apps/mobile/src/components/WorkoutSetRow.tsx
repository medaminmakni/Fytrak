import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { radius, spacing, typography } from "../theme/tokens";
import { ToastService } from "./Toast";
import type { WorkoutSet, WorkoutSetType } from "../types/domain";
import { parseRpeInput } from "../features/workouts/workoutPerformance";

interface WorkoutSetRowProps {
  set: WorkoutSet;
  sIdx: number;
  type: WorkoutSetType;
  /**
   * The first incomplete set: the one being worked right now.
   *
   * Every row looked identical before, so on a five-set exercise the trainee had
   * to re-find their place after every rest. The design tints exactly one.
   */
  isActive?: boolean;
  onUpdateSet: (field: keyof WorkoutSet, value: any) => void;
  onToggleSet: () => void;
}

/**
 * One set.
 *
 * RPE IS A COLUMN NOW, AND THAT IS THE SUBSTANTIVE CHANGE.
 *
 * `rpe` has existed on `WorkoutSet` since the type was written, and nothing in
 * the app ever wrote it — no field on this row, and no way for a coach to
 * prescribe one either. It is the value that later tells a coach the load was
 * wrong: RPE 10 against an asked 8 is a different conversation from RPE 7, and
 * without it the coach's session review can only compare weights, which move
 * for reasons that have nothing to do with how hard the set was.
 *
 * It is OPTIONAL and never blocks completion. A trainee who does not rate a set
 * leaves it blank and the cell shows an em dash — absence stated, not a zero
 * invented. Only weight, reps and duration gate the tick, exactly as before.
 */
export function WorkoutSetRow({ set, sIdx, type, isActive = false, onUpdateSet, onToggleSet }: WorkoutSetRowProps) {
  const handleToggle = () => {
    // Unchanged. These are the only fields that gate completion.
    if (!set.isCompleted) {
      if (type === "WEIGHT_REPS" && (!set.reps || !set.weight)) {
        ToastService.info("Missing Data", "Please enter weight and reps.");
        return;
      }
      if (type === "TIME" && !set.durationSec) {
        ToastService.info("Missing Data", "Please enter a duration.");
        return;
      }
      if ((type === "BODYWEIGHT" || type === "REPS_ONLY") && !set.reps) {
        ToastService.info("Missing Data", "Please enter reps.");
        return;
      }
    }
    onToggleSet();
  };

  /** The rule lives in `workoutPerformance` so it can be tested. */
  const handleRpe = (raw: string) => {
    const parsed = parseRpeInput(raw);
    if (parsed.ok) onUpdateSet("rpe", parsed.rpe);
  };

  return (
    <View
      style={[
        styles.setRow,
        set.isCompleted && styles.setRowCompleted,
        isActive && !set.isCompleted && styles.setRowActive,
      ]}
    >
      <Text style={[styles.setNumber, isActive && !set.isCompleted && styles.setNumberActive]}>
        {sIdx + 1}
      </Text>

      {type === "TIME" ? (
        <TextInput
          style={styles.setInput}
          value={set.durationSec?.toString()}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.textTertiary}
          onChangeText={(v) => onUpdateSet("durationSec", Number(v))}
          editable={!set.isCompleted}
          accessibilityLabel={`Set ${sIdx + 1} duration in seconds`}
        />
      ) : type === "BODYWEIGHT" || type === "REPS_ONLY" ? (
        <TextInput
          style={styles.setInput}
          value={set.reps?.toString()}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.textTertiary}
          onChangeText={(v) => onUpdateSet("reps", Number(v))}
          editable={!set.isCompleted}
          accessibilityLabel={`Set ${sIdx + 1} reps`}
        />
      ) : (
        <>
          <TextInput
            style={styles.setInput}
            value={set.weight?.toString()}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={colors.textTertiary}
            onChangeText={(v) => onUpdateSet("weight", Number(v))}
            editable={!set.isCompleted}
            accessibilityLabel={`Set ${sIdx + 1} weight`}
          />
          <TextInput
            style={styles.setInput}
            value={set.reps?.toString()}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={colors.textTertiary}
            onChangeText={(v) => onUpdateSet("reps", Number(v))}
            editable={!set.isCompleted}
            accessibilityLabel={`Set ${sIdx + 1} reps`}
          />
        </>
      )}

      <TextInput
        style={[styles.setInput, styles.rpeInput]}
        value={set.rpe ?? ""}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="—"
        placeholderTextColor={colors.textTertiary}
        onChangeText={handleRpe}
        editable={!set.isCompleted}
        accessibilityLabel={`Set ${sIdx + 1} rate of perceived exertion, 1 to 10, optional`}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={set.isCompleted ? `Mark set ${sIdx + 1} incomplete` : `Complete set ${sIdx + 1}`}
        accessibilityState={{ checked: set.isCompleted }}
        hitSlop={8}
        style={styles.checkBtn}
        onPress={handleToggle}
      >
        <Ionicons
          name={set.isCompleted ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={set.isCompleted ? colors.primary : colors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.nested,
    // 52pt rows: thumb-sized, per the design. Was 8pt padding around a 44 input.
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  /* Done. Flat and quiet — a finished set is a record, not an action. */
  setRowCompleted: { backgroundColor: colors.surface },
  /* The one set being worked. The only tinted row in the table. */
  setRowActive: { backgroundColor: colors.primaryMuted },
  setNumber: { ...typography.bodyStrong, color: colors.textSecondary, flex: 0.5, textAlign: "center" },
  setNumberActive: { color: colors.primary },
  setInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.nested,
    height: 40,
    color: colors.text,
    ...typography.bodyStrong,
    textAlign: "center",
  },
  rpeInput: { fontVariant: ["tabular-nums"] },
  checkBtn: { flex: 0.5, height: 44, alignItems: "center", justifyContent: "center" },
});
