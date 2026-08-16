import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

interface MacroItemProps {
  label: string;
  current: number;
  /**
   * Null when the trainee has no target for this macro.
   *
   * `current / target` with target 0 or undefined yields Infinity or NaN, and
   * `width: "NaN%"` silently renders an empty bar — visually identical to a
   * real 0% against a real target.
   */
  target: number | null;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export function MacroItem({ label, current, target, color, icon }: MacroItemProps) {
  const hasTarget = typeof target === "number" && Number.isFinite(target) && target > 0;
  // No target means no proportion to draw. The bar stays empty rather than
  // filling against an invented denominator.
  const progress = hasTarget ? Math.min(Math.max(current / (target as number), 0), 1) : 0;
  return (
    <View style={styles.macroItem}>
      <View style={styles.macroHeader}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={styles.macroLabel}>{label}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroValue}>
        {hasTarget ? `${current}g / ${target}g` : `${current}g logged`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  macroItem: {
    flex: 1,
    gap: 8,
  },
  macroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  macroLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  barBg: {
    height: 6,
    backgroundColor: colors.surfaceInset,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  macroValue: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
});
