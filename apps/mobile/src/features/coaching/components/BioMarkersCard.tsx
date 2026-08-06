import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { colors } from "../../../theme/colors";
import { spacing, radius } from "../../../theme/tokens";

type BioMarkersCardProps = {
  weight?: number;
  bodyFat?: number;
};

export function BioMarkersCard({ weight, bodyFat }: BioMarkersCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: 'rgba(96, 165, 250, 0.1)' }]}>
          <Ionicons name="body" size={14} color={colors.info} />
        </View>
        <Typography variant="label" color={colors.info} style={styles.title}>BIO-MARKERS</Typography>
      </View>
      <View style={styles.grid}>
        <View style={styles.metricBox}>
          <Typography variant="label" color={colors.textFaint} style={styles.metricLabel}>WEIGHT</Typography>
          <Typography variant="h2" style={styles.metricValue}>
            {weight || "--"} <Typography variant="label" color={colors.textDim}>kg</Typography>
          </Typography>
        </View>
        <View style={styles.metricBox}>
          <Typography variant="label" color={colors.textFaint} style={styles.metricLabel}>BODY FAT</Typography>
          <Typography variant="h2" style={styles.metricValue}>
            {bodyFat || "--"} <Typography variant="label" color={colors.textDim}>%</Typography>
          </Typography>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginStart: 4 },
  iconBox: { width: 26, height: 26, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  grid: { flexDirection: 'row', gap: spacing.md },
  metricBox: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong, gap: spacing.xxs },
  metricLabel: { fontSize: 11 },
  metricValue: { fontSize: 20 },
});
