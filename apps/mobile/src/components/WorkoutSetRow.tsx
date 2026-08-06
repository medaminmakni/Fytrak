import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { ToastService } from "./Toast";
import type { WorkoutSet, WorkoutSetType } from "../types/domain";

interface WorkoutSetRowProps {
  set: WorkoutSet;
  sIdx: number;
  type: WorkoutSetType;
  onUpdateSet: (field: keyof WorkoutSet, value: any) => void;
  onToggleSet: () => void;
}

export function WorkoutSetRow({ set, sIdx, type, onUpdateSet, onToggleSet }: WorkoutSetRowProps) {
  const handleToggle = () => {
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

  return (
    <View style={[styles.setRow, set.isCompleted && styles.setRowCompleted]}>
      <Text style={[styles.setText, { flex: 0.5 }]}>{sIdx + 1}</Text>

      {type === "TIME" ? (
        <TextInput
          style={styles.setInput}
          value={set.durationSec?.toString()}
          keyboardType="number-pad"
          placeholder="-"
          placeholderTextColor={colors.textDim}
          onChangeText={(v) => onUpdateSet("durationSec", Number(v))}
          editable={!set.isCompleted}
        />
      ) : type === "BODYWEIGHT" || type === "REPS_ONLY" ? (
        <TextInput
          style={styles.setInput}
          value={set.reps?.toString()}
          keyboardType="number-pad"
          placeholder="-"
          placeholderTextColor={colors.textDim}
          onChangeText={(v) => onUpdateSet("reps", Number(v))}
          editable={!set.isCompleted}
        />
      ) : (
        <>
          <TextInput
            style={styles.setInput}
            value={set.weight?.toString()}
            keyboardType="decimal-pad"
            placeholder="-"
            placeholderTextColor={colors.textDim}
            onChangeText={(v) => onUpdateSet("weight", Number(v))}
            editable={!set.isCompleted}
          />
          <TextInput
            style={styles.setInput}
            value={set.reps?.toString()}
            keyboardType="number-pad"
            placeholder="-"
            placeholderTextColor={colors.textDim}
            onChangeText={(v) => onUpdateSet("reps", Number(v))}
            editable={!set.isCompleted}
          />
        </>
      )}

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
          color={set.isCompleted ? colors.primary : "#333"}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  setRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1c1c1e", borderRadius: 16, padding: 8, marginBottom: 8, gap: 8 },
  setRowCompleted: { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30", borderWidth: 1 },
  setText: { color: colors.textMuted, fontSize: 14, fontWeight: "800", textAlign: "center" },
  setInput: { flex: 1, backgroundColor: "#111", borderRadius: 10, height: 44, color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
  checkBtn: { flex: 0.5, height: 44, alignItems: "center", justifyContent: "center" },
});
