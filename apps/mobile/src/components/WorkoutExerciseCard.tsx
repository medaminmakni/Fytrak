import React from "react";
import { I18nManager, View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { typography } from "../theme/tokens";
import { ToastService } from "./Toast";
import type { ActiveWorkoutExerciseDraft } from "../features/workouts/activeWorkoutDraft";
import type { WorkoutSetType, WorkoutSet } from "../types/domain";
import { WorkoutSetRow } from "./WorkoutSetRow";

type ExerciseLog = ActiveWorkoutExerciseDraft;

interface WorkoutExerciseCardProps {
  ex: ExerciseLog;
  exIdx: number;
  previousSummary?: string;
  previousSets?: WorkoutSet[];
  hasVideoUrl?: boolean;
  onSearchExercise: () => void;
  onOpenDetails: () => void;
  onRemove: () => void;
  onUpdateType: (type: WorkoutSetType) => void;
  onUpdateSet: (sIdx: number, field: keyof WorkoutSet, value: any) => void;
  onToggleSet: (sIdx: number) => void;
  onDuplicateSet: () => void;
  onApplyPrevious: (sets: WorkoutSet[]) => void;
}

export function WorkoutExerciseCard({
  ex,
  exIdx,
  previousSummary,
  previousSets,
  hasVideoUrl,
  onSearchExercise,
  onOpenDetails,
  onRemove,
  onUpdateType,
  onUpdateSet,
  onToggleSet,
  onDuplicateSet,
  onApplyPrevious,
}: WorkoutExerciseCardProps) {
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseNameRow}>
          <Pressable style={styles.exerciseNameInput} onPress={onSearchExercise}>
            <Text style={{ color: ex.name ? colors.primary : colors.textDim, ...typography.heading }}>
              {ex.name || "Tap to select exercise..."}
            </Text>
          </Pressable>
          <View style={styles.exerciseActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open details for ${ex.name || "exercise"}`}
              hitSlop={8}
              style={styles.infoIconBtn}
              onPress={() => {
                if (ex.name) onOpenDetails();
                else ToastService.info("Not Found", "No detailed instructions available for this exercise.");
              }}
            >
              <Ionicons name={hasVideoUrl ? "videocam" : "information-circle-outline"} size={22} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${ex.name || "exercise"}`}
              hitSlop={8}
              style={styles.removeExerciseBtn}
              onPress={onRemove}
            >
              <Ionicons name="close-circle-outline" size={26} color={colors.danger} />
            </Pressable>
          </View>
        </View>
        <View style={styles.typeSelectorRow}>
          {(["WEIGHT_REPS", "TIME", "BODYWEIGHT"] as WorkoutSetType[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.typePill, ex.type === t && styles.typePillActive]}
              onPress={() => onUpdateType(t)}
            >
              <Text style={[styles.typePillText, ex.type === t && styles.typePillTextActive]}>{t.replace("_", " ")}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {previousSets && previousSets.length > 0 && previousSummary ? (
        <Pressable style={styles.previousValuesCard} onPress={() => onApplyPrevious(previousSets)}>
          <View style={styles.previousValuesIcon}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.previousValuesLabel}>LAST SESSION</Text>
            <Text style={styles.previousValuesText} numberOfLines={1}>
              {previousSummary}
            </Text>
          </View>
          <View style={styles.previousValuesAction}>
            <Text style={styles.previousValuesActionText}>USE</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.tableHeader}>
        <Text style={[styles.columnLabel, styles.columnLabelStart, { flex: 0.5 }]}>SET</Text>
        {ex.type === "TIME" ? (
          <Text style={styles.columnLabel}>SECONDS</Text>
        ) : ex.type === "BODYWEIGHT" || ex.type === "REPS_ONLY" ? (
          <Text style={styles.columnLabel}>REPS</Text>
        ) : (
          <>
            <Text style={styles.columnLabel}>KG</Text>
            <Text style={styles.columnLabel}>REPS</Text>
          </>
        )}
        <Text style={{ flex: 0.5 }} />
      </View>

      {ex.sets.map((set, sIdx) => (
        <WorkoutSetRow
          key={sIdx}
          set={set}
          sIdx={sIdx}
          type={ex.type!}
          onUpdateSet={(field, value) => onUpdateSet(sIdx, field, value)}
          onToggleSet={() => onToggleSet(sIdx)}
        />
      ))}

      <Pressable style={styles.addSetBtn} onPress={onDuplicateSet}>
        <Ionicons name="copy-outline" size={18} color={colors.primary} />
        <Text style={styles.addSetText}>DUPLICATE SET</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseCard: {
    backgroundColor: "#161616",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2c2c2e",
  },
  exerciseHeader: { gap: 16, marginBottom: 20 },
  exerciseNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  exerciseNameInput: { flex: 1, paddingVertical: 8 },
  exerciseActions: { flexDirection: "row", gap: 8 },
  infoIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2c2c2e", alignItems: "center", justifyContent: "center" },
  removeExerciseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  typeSelectorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "#1c1c1e", borderWidth: 1, borderColor: "#2c2c2e" },
  typePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typePillText: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  typePillTextActive: { color: "#000" },
  tableHeader: { flexDirection: "row", marginBottom: 12, paddingHorizontal: 12, alignItems: "center" },
  columnLabel: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: "900", textAlign: "center", letterSpacing: 0.5 },
  columnLabelStart: { textAlign: I18nManager.isRTL ? "right" : "left" },
  addSetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, paddingVertical: 12, backgroundColor: "#1c1c1e", borderRadius: 16, borderStyle: "dashed", borderWidth: 1, borderColor: "#333" },
  addSetText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  previousValuesCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#1c1c1e", borderRadius: 16, padding: 12, marginBottom: 16, gap: 12, borderWidth: 1, borderColor: "#2c2c2e", borderLeftWidth: 3, borderLeftColor: colors.primary },
  previousValuesIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" },
  previousValuesLabel: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 0.5, marginBottom: 2 },
  previousValuesText: { color: "#aaa", fontSize: 13, fontWeight: "600" },
  previousValuesAction: { backgroundColor: "#2c2c2e", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  previousValuesActionText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
