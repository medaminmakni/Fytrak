import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

interface MacroItemProps {
  label: string;
  current: number;
  target: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export function MacroItem({ label, current, target, color, icon }: MacroItemProps) {
  const progress = Math.min(current / target, 1);
  return (
    <View style={styles.macroItem}>
      <View style={styles.macroHeader}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={styles.macroLabel}>{label}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroValue}>{current}g / {target}g</Text>
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
    backgroundColor: "#2c2c2e",
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
