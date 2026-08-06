import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { spacing, radius } from "../../../theme/tokens";

interface RestTimerProps {
  value: number;
  onAdjust: (delta: number) => void;
  onSkip: () => void;
}

export function RestTimer({ value, onAdjust, onSkip }: RestTimerProps) {
  return (
    <View style={styles.floatingTimer}>
      <View style={styles.timerInfo}>
        <Ionicons name="timer" size={20} color="#000" />
        <Text style={styles.timerBold}>{Math.floor(value / 60)}:{String(value % 60).padStart(2, "0")}</Text>
      </View>
      <Pressable style={styles.timerActionBtn} onPress={() => onAdjust(30)}>
        <Text style={styles.timerActionText}>+30s</Text>
      </Pressable>
      <View style={styles.timerDivider} />
      <Pressable style={styles.timerActionBtn} onPress={onSkip}>
        <Ionicons name="play-skip-forward" size={18} color="#000" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingTimer: { position: "absolute", bottom: 178, alignSelf: "center", backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, elevation: 10 },
  timerInfo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingEnd: spacing.md },
  timerBold: { color: colors.primaryText, fontWeight: "900", fontSize: 16 },
  timerActionBtn: { paddingHorizontal: spacing.md, minHeight: 34, justifyContent: "center", alignItems: "center" },
  timerActionText: { color: colors.primaryText, fontWeight: "900", fontSize: 13 },
  timerDivider: { width: 1, height: 20, backgroundColor: "rgba(0,0,0,0.2)" },
});
