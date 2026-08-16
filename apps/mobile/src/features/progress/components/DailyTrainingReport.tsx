import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { radius, spacing } from "../../../theme/tokens";
import { Typography } from "../../../components/Typography";
import type { WorkoutLog } from "../../../types/domain";

type DailyTrainingReportProps = {
  workout?: WorkoutLog;
};

export function DailyTrainingReport({ workout }: DailyTrainingReportProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="barbell" size={18} color="#f87171" />
        <Text style={[styles.sectionTitle, { color: "#f87171" }]}>TRAINING ACTIVITY</Text>
      </View>
      {workout ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Typography variant="h2" style={{ fontSize: 18 }}>{workout.name}</Typography>
              <Typography variant="label" color={colors.textMuted}>
                {workout.duration || 0} min • {workout.totalVolume || 0}kg volume
              </Typography>
            </View>
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={16} color="#000" />
            </View>
          </View>
          <View style={styles.exerciseList}>
            {workout.exercises.map((ex, idx) => (
              <View key={idx} style={styles.exItem}>
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exSets}>{ex.sets.length} sets</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Typography variant="label" color={colors.textDim}>Rest Day - No workout logged</Typography>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginStart: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: "#222" },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xl },
  checkBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  exerciseList: { gap: spacing.sm },
  exItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: "#222" },
  exName: { color: "#fff", fontSize: 13, fontWeight: "700" },
  exSets: { color: "#888", fontSize: 11, fontWeight: "800" },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing["4xl"], alignItems: 'center', borderWidth: 1, borderColor: "#222", borderStyle: "dashed" },
});
