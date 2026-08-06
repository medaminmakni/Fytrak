import React from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { colors } from "../theme/colors";

interface BFRowProps {
  label: string;
  male: string;
  female: string;
  desc: string;
  onSelect: () => void;
}

export function BFRow({ label, male, female, desc, onSelect }: BFRowProps) {
  return (
    <Pressable style={styles.bfRow} onPress={onSelect}>
      <View style={styles.bfRowHeader}>
        <Text style={styles.bfRowLabel}>{label}</Text>
        <View style={styles.tagGroup}>
          <View style={[styles.genderTag, { backgroundColor: "#3b82f640" }]}>
            <Text style={styles.genderTagText}>M: {male}</Text>
          </View>
          <View style={[styles.genderTag, { backgroundColor: "#ec489940" }]}>
            <Text style={styles.genderTagText}>F: {female}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.bfRowDesc}>{desc}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bfRow: { 
    backgroundColor: "#1c1c1e", 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: "#2c2c2e" 
  },
  bfRowHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 8 
  },
  bfRowLabel: { 
    color: "#fff", 
    fontSize: 15, 
    fontWeight: "800" 
  },
  tagGroup: { 
    flexDirection: "row", 
    gap: 8 
  },
  genderTag: { 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  genderTagText: { 
    color: "#fff", 
    fontSize: 11, 
    fontWeight: "900" 
  },
  bfRowDesc: { 
    color: colors.textMuted, 
    fontSize: 12, 
    fontWeight: "500" 
  },
});
