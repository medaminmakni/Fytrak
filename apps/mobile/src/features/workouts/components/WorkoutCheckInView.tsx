import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { colors } from "../../../theme/colors";
import { radius, spacing, touchTarget, typography } from "../../../theme/tokens";
import type { WorkoutPersonalRecord } from "../workoutPerformance";

type WorkoutCheckInViewProps = {
  workoutName: string;
  totalSetsCompleted: number;
  totalVolume: number;
  durationMinutes: number;
  personalRecords: WorkoutPersonalRecord[];
  energy: number;
  onEnergyChange: (value: number) => void;
  soreness: number;
  onSorenessChange: (value: number) => void;
  mood: number;
  onMoodChange: (value: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
};

export function WorkoutCheckInView({
  workoutName,
  totalSetsCompleted,
  totalVolume,
  durationMinutes,
  personalRecords,
  energy,
  onEnergyChange,
  soreness,
  onSorenessChange,
  mood,
  onMoodChange,
  onSubmit,
  onBack,
  isSubmitting,
}: WorkoutCheckInViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.completionSummaryCard}>
        <View style={styles.completionHeader}>
          <View>
            <Typography variant="label" color={colors.primary}>
              SESSION COMPLETE
            </Typography>
            <Typography variant="h2" style={styles.completionTitle}>
              {workoutName}
            </Typography>
          </View>
          {personalRecords.length > 0 ? (
            <View style={styles.prPill}>
              <Ionicons name="trophy" size={14} color={colors.primaryText} />
              <Text style={styles.prPillText}>{personalRecords.length} PR</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.completionStatsRow}>
          <View style={styles.completionStat}>
            <Text style={styles.completionValue}>{totalSetsCompleted}</Text>
            <Text style={styles.completionLabel}>sets</Text>
          </View>
          <View style={styles.completionStat}>
            <Text style={styles.completionValue}>{totalVolume}</Text>
            <Text style={styles.completionLabel}>kg volume</Text>
          </View>
          <View style={styles.completionStat}>
            <Text style={styles.completionValue}>{durationMinutes}</Text>
            <Text style={styles.completionLabel}>minutes</Text>
          </View>
        </View>
        {personalRecords[0] ? (
          <View style={styles.prCallout}>
            <Ionicons name="flash" size={16} color={colors.primary} />
            <Text style={styles.prCalloutText}>
              {personalRecords[0].exerciseName}: {personalRecords[0].estimatedOneRepMax}kg estimated 1RM
            </Text>
          </View>
        ) : null}
      </View>

      <CheckInRating label="Energy Level" value={energy} onSelect={onEnergyChange} />
      <CheckInRating label="Muscle Soreness" value={soreness} onSelect={onSorenessChange} />

      <View style={styles.checkInCard}>
        <Text style={styles.checkInTitle}>Mood / Focus</Text>
        <View style={styles.ratingRow}>
          {["Low", "OK", "Good", "Fire", "Peak"].map((moodLabel, idx) => (
            <Pressable
              key={moodLabel}
              accessibilityRole="button"
              accessibilityLabel={`Mood ${moodLabel}`}
              accessibilityState={{ selected: mood === idx + 1 }}
              style={[styles.emojiCircle, mood === idx + 1 && styles.emojiCircleActive]}
              onPress={() => onMoodChange(idx + 1)}
            >
              <Text style={[styles.moodText, mood === idx + 1 && styles.moodTextActive]}>
                {moodLabel}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.finishBtn, isSubmitting && styles.finishBtnDisabled]}
        onPress={onSubmit}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!isSubmitting, busy: !!isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <>
            <Text style={styles.finishBtnText}>SUBMIT LOG</Text>
            <Ionicons name="cloud-upload" size={20} color={colors.primaryText} />
          </>
        )}
      </Pressable>
      <Pressable style={styles.cancelLink} onPress={onBack} disabled={isSubmitting}>
        <Text style={styles.cancelLinkText}>Back to workout</Text>
      </Pressable>
    </ScrollView>
  );
}

type CheckInRatingProps = {
  label: string;
  value: number;
  onSelect: (value: number) => void;
};

function CheckInRating({ label, value, onSelect }: CheckInRatingProps) {
  return (
    <View style={styles.checkInCard}>
      <Text style={styles.checkInTitle}>{label}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <Pressable
            key={rating}
            style={[styles.ratingCircle, value === rating && styles.ratingCircleActive]}
            onPress={() => onSelect(rating)}
          >
            <Text style={[styles.ratingText, value === rating && styles.ratingTextActive]}>
              {rating}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 220, gap: spacing.lg },
  completionSummaryCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.lg,
  },
  completionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  completionTitle: { color: colors.text, fontSize: 22, lineHeight: 28 },
  prPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 32,
  },
  prPillText: { color: colors.primaryText, fontSize: 11, fontWeight: "900" },
  completionStatsRow: { flexDirection: "row", gap: spacing.sm },
  completionStat: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  completionValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  completionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: spacing.xs,
  },
  prCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,204,0,0.22)",
  },
  prCalloutText: { flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  checkInCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  checkInTitle: { color: colors.text, ...typography.heading, textAlign: "center" },
  ratingRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  ratingCircle: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  ratingCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ratingText: { color: colors.textMuted, fontSize: 16, fontWeight: "800" },
  ratingTextActive: { color: colors.primaryText },
  emojiCircle: {
    minWidth: 54,
    height: touchTarget.comfortable,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.sm,
  },
  emojiCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  moodText: { color: colors.textMuted, ...typography.label, fontSize: 11 },
  moodTextActive: { color: colors.primaryText },
  finishBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  finishBtnDisabled: { opacity: 0.6 },
  finishBtnText: { color: colors.primaryText, ...typography.button, fontSize: 16 },
  cancelLink: { alignItems: "center", paddingVertical: spacing.lg },
  cancelLinkText: { color: colors.textFaint, fontWeight: "700" },
});
