import React from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

interface MetricStepperProps {
  label: string;
  value: number | string;
  onAdjust: (d: number) => void;
}

export function MetricStepper({ label, value, onAdjust }: MetricStepperProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
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

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    gap: 4, 
    marginBottom: 12 
  },
  label: { 
    color: colors.textMuted,
    fontSize: 14, 
    fontWeight: "600", 
    marginBottom: 4 
  },
  stepperContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: colors.surfaceInset,
    borderRadius: 12, 
    padding: 4, 
    borderWidth: 1, 
    borderColor: colors.surfaceInset
  },
  stepperBtn: { 
    width: 36, 
    height: 36, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  stepperValueText: { 
    flex: 1, 
    textAlign: "center", 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "800" 
  },
});
