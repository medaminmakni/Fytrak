import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { colors } from "../../../theme/colors";
import { spacing, radius } from "../../../theme/tokens";
import type { WorkoutLog } from "../../../types/domain";
import type { DataStatus } from "../../../hooks/useTraineeDetailData";

type TrainingIntelligenceCardProps = {
  /**
   * Every workout logged on the selected day. A client can train more than
   * once (for example strength in the morning and cardio in the evening), so
   * this is a list — rendering only the first would understate their work.
   */
  workouts?: WorkoutLog[];
  /**
   * The full load state of the workouts dimension.
   *
   * This was `hasError?: boolean`, which is only two of the four states. While
   * the read was still in flight the card received `hasError={false}` and the
   * default `workouts = []`, so it rendered "No workout logged today" about a
   * day it had not finished reading — and if that read then failed at the 12s
   * timeout, the sentence had already been on screen for twelve seconds.
   */
  status?: DataStatus;
  /** Label for the selected day, e.g. "today" or "Mon 14 Jul". */
  dayLabel?: string;
};

export function TrainingIntelligenceCard({
  workouts = [],
  status = "loaded",
  dayLabel = "today",
}: TrainingIntelligenceCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: 'rgba(248, 113, 113, 0.1)' }]}>
          <Ionicons name="barbell" size={14} color={colors.danger} />
        </View>
        <Typography variant="label" color={colors.danger} style={styles.title}>TRAINING ACTIVITY</Typography>
        {status === "loaded" && workouts.length > 1 && (
          <Typography variant="label" color={colors.textDim} style={styles.countBadge}>
            {workouts.length} SESSIONS
          </Typography>
        )}
      </View>

      {status === "error" ? (
        <View style={styles.errorCard}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} />
          <Typography variant="label" color={colors.warning}>
            Unavailable — could not load
          </Typography>
        </View>
      ) : status === "loading" ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color={colors.textTertiary} />
          <Typography variant="label" color={colors.textDim}>Loading…</Typography>
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.emptyCard}>
          {/* The single source of the empty workout sentence. */}
          <Typography variant="label" color={colors.textDim}>No workout logged this day</Typography>
        </View>
      ) : (
        workouts.map((workout) => (
          <View key={workout.id} style={styles.card}>
            <View style={styles.workoutHeader}>
              <View style={{ flex: 1 }}>
                <Typography variant="h2" style={styles.workoutName}>{workout.name}</Typography>
                <Typography variant="label" color={colors.textFaint}>{workout.duration || 0} min • {workout.totalVolume || 0}kg volume</Typography>
              </View>
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={16} color={colors.primaryText} />
              </View>
            </View>
            <View style={styles.exerciseList}>
              {(workout.exercises ?? []).slice(0, 4).map((ex, idx) => (
                <View key={idx} style={styles.exItem}>
                  <Typography variant="h2" style={styles.exName} numberOfLines={1}>{ex.name}</Typography>
                  <Typography variant="label" color={colors.textDim}>{ex.sets.length} sets</Typography>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginStart: 4 },
  countBadge: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  iconBox: { width: 26, height: 26, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  card: { backgroundColor: colors.surfaceMuted, borderRadius: radius["2xl"], padding: spacing.xl, borderWidth: 1, borderColor: colors.borderStrong },
  workoutHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  workoutName: { fontSize: 18 },
  checkBadge: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  exerciseList: { gap: spacing.sm },
  exItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgDark, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle },
  exName: { fontSize: 13, flex: 1 },
  emptyCard: { backgroundColor: colors.bgDark, borderRadius: radius.xl, padding: spacing["3xl"], alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle, borderStyle: 'dashed' },
});
