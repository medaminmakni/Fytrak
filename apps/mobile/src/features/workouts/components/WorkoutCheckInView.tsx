import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { colors } from "../../../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../../../theme/tokens";
import type { WorkoutPersonalRecord } from "../workoutPerformance";
import {
  PAIN_NOTE_MAX_LENGTH,
  RATING_MAX,
  RATING_MIN,
  SLEEP_MAX_HOURS,
  SLEEP_MIN_HOURS,
  SLEEP_STEP_HOURS,
  SORE_AREAS,
  SORE_AREA_LABEL,
  hasAnyAnswer,
  validateCheckInDraft,
  type CheckInDraft,
  type SoreArea,
} from "../checkIn";

type WorkoutCheckInViewProps = {
  workoutName: string;
  totalSetsCompleted: number;
  totalVolume: number;
  durationMinutes: number;
  personalRecords: WorkoutPersonalRecord[];
  draft: CheckInDraft;
  onDraftChange: (next: CheckInDraft) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
};

/**
 * The post-session check-in.
 *
 * Nothing here is pre-answered. The previous version opened with energy,
 * soreness and mood on 3 and sleep on 7.5h, and wrote them whether or not the
 * client touched anything — so a coach could read "7.5h, energy 3" that the
 * form had invented. Every control now starts empty and stays empty until
 * tapped.
 *
 * The whole thing is skippable. A client who is done and wants out gets to
 * leave; the session still saves. The only thing that blocks submission is a
 * pain flag with no description, because that combination tells a coach
 * something is wrong and nothing about what.
 */
export function WorkoutCheckInView({
  workoutName,
  totalSetsCompleted,
  totalVolume,
  durationMinutes,
  personalRecords,
  draft,
  onDraftChange,
  onSubmit,
  onBack,
  isSubmitting,
}: WorkoutCheckInViewProps) {
  const set = <K extends keyof CheckInDraft>(key: K, value: CheckInDraft[K]) =>
    onDraftChange({ ...draft, [key]: value });

  const toggleArea = (area: SoreArea) =>
    set(
      "soreAreas",
      draft.soreAreas.includes(area)
        ? draft.soreAreas.filter((item) => item !== area)
        : [...draft.soreAreas, area],
    );

  const validation = validateCheckInDraft(draft);
  const answeredAnything = hasAnyAnswer(draft);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.completionSummaryCard}>
        <View style={styles.completionHeader}>
          <View>
            <Typography variant="label" color={colors.primary}>
              Session complete
            </Typography>
            <Typography variant="h2" style={styles.completionTitle}>
              {workoutName}
            </Typography>
          </View>
          {personalRecords.length > 0 ? (
            <View style={styles.prPill}>
              <Ionicons name="trophy" size={iconSize.sm} color={colors.primaryText} />
              <Text style={styles.prPillText}>{personalRecords.length} PR</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.completionStatsRow}>
          <Stat value={String(totalSetsCompleted)} label="sets" />
          <Stat value={String(totalVolume)} label="kg volume" />
          <Stat value={String(durationMinutes)} label="minutes" />
        </View>
        {personalRecords[0] ? (
          <View style={styles.prCallout}>
            <Ionicons name="flash" size={iconSize.sm} color={colors.primary} />
            <Text style={styles.prCalloutText}>
              {personalRecords[0].exerciseName}: {personalRecords[0].estimatedOneRepMax}kg estimated 1RM
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.optionalNote}>
        All optional — your coach sees anything you leave blank as “not answered”.
      </Text>

      <Rating
        label="Energy"
        value={draft.energy}
        onSelect={(value) => set("energy", value)}
        onClear={() => set("energy", null)}
      />
      <Rating
        label="Mood"
        value={draft.mood}
        onSelect={(value) => set("mood", value)}
        onClear={() => set("mood", null)}
      />

      {/* Sleep has no default. Tapping either arrow is what answers it. */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Sleep last night</Text>
          {draft.sleepHours !== null ? (
            <ClearButton onPress={() => set("sleepHours", null)} />
          ) : null}
        </View>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            accessibilityRole="button"
            accessibilityLabel="Less sleep"
            onPress={() =>
              set(
                "sleepHours",
                draft.sleepHours === null
                  ? 7
                  : Math.max(SLEEP_MIN_HOURS, draft.sleepHours - SLEEP_STEP_HOURS),
              )
            }
          >
            <Ionicons name="remove" size={iconSize.lg} color={colors.text} />
          </Pressable>
          <View style={styles.stepperValueBox}>
            {draft.sleepHours === null ? (
              <Text style={styles.notAnswered}>Not answered</Text>
            ) : (
              <>
                <Text style={styles.stepperValue}>{draft.sleepHours}</Text>
                <Text style={styles.stepperUnit}>hours</Text>
              </>
            )}
          </View>
          <Pressable
            style={styles.stepperButton}
            accessibilityRole="button"
            accessibilityLabel="More sleep"
            onPress={() =>
              set(
                "sleepHours",
                draft.sleepHours === null
                  ? 8
                  : Math.min(SLEEP_MAX_HOURS, draft.sleepHours + SLEEP_STEP_HOURS),
              )
            }
          >
            <Ionicons name="add" size={iconSize.lg} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/*
        Body areas rather than a 1-5 soreness score. "Soreness 4" tells a coach
        how much; it never tells them where, which is what decides whether
        tomorrow's session changes.
      */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Anything sore?</Text>
          {draft.soreAreas.length > 0 ? (
            <ClearButton onPress={() => set("soreAreas", [])} />
          ) : null}
        </View>
        <View style={styles.areaGrid}>
          {SORE_AREAS.map((area) => {
            const selected = draft.soreAreas.includes(area);
            return (
              <Pressable
                key={area}
                style={[styles.areaChip, selected && styles.areaChipActive]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={SORE_AREA_LABEL[area]}
                onPress={() => toggleArea(area)}
              >
                <Text style={[styles.areaLabel, selected && styles.areaLabelActive]}>
                  {SORE_AREA_LABEL[area]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/*
        Pain is separate from soreness on purpose. Soreness is a normal outcome
        of a hard session; pain is a stop signal, and on one scale it reads as
        "a bit high this week" and gets missed.
      */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Did anything hurt?</Text>
        <Text style={styles.cardHint}>
          Not normal muscle soreness — sharp, joint, or lasting pain.
        </Text>
        <View style={styles.painRow}>
          <Pressable
            style={[styles.painChoice, draft.painFlagged === false && styles.painChoiceActiveNo]}
            accessibilityRole="radio"
            accessibilityState={{ checked: draft.painFlagged === false }}
            accessibilityLabel="No pain"
            onPress={() => set("painFlagged", draft.painFlagged === false ? null : false)}
          >
            <Text
              style={[
                styles.painChoiceText,
                draft.painFlagged === false && styles.painChoiceTextActive,
              ]}
            >
              No
            </Text>
          </Pressable>
          <Pressable
            style={[styles.painChoice, draft.painFlagged === true && styles.painChoiceActiveYes]}
            accessibilityRole="radio"
            accessibilityState={{ checked: draft.painFlagged === true }}
            accessibilityLabel="Yes, something hurt"
            onPress={() => set("painFlagged", draft.painFlagged === true ? null : true)}
          >
            <Text
              style={[
                styles.painChoiceText,
                draft.painFlagged === true && styles.painChoiceTextActive,
              ]}
            >
              Yes
            </Text>
          </Pressable>
        </View>

        {draft.painFlagged === true ? (
          <>
            <TextInput
              style={styles.painInput}
              value={draft.painNote}
              onChangeText={(value) => set("painNote", value)}
              placeholder="Where, and what did it feel like?"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={PAIN_NOTE_MAX_LENGTH}
              accessibilityLabel="Describe the pain"
            />
            {!validation.ok ? (
              <Text style={styles.validationText} accessibilityLiveRegion="polite">
                {validation.message}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>

      <Pressable
        style={[styles.finishBtn, (isSubmitting || !validation.ok) && styles.finishBtnBlocked]}
        onPress={onSubmit}
        disabled={isSubmitting || !validation.ok}
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting || !validation.ok, busy: !!isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <>
            <Text style={styles.finishBtnText}>
              {answeredAnything ? "Save session" : "Save without check-in"}
            </Text>
            <Ionicons name="cloud-upload" size={iconSize.md} color={colors.primaryText} />
          </>
        )}
      </Pressable>

      <Pressable style={styles.cancelLink} onPress={onBack} disabled={isSubmitting}>
        <Text style={styles.cancelLinkText}>Back to workout</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.completionStat}>
      <Text style={styles.completionValue}>{value}</Text>
      <Text style={styles.completionLabel}>{label}</Text>
    </View>
  );
}

function ClearButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Clear this answer"
      style={styles.clearButton}
    >
      <Text style={styles.clearButtonText}>Clear</Text>
    </Pressable>
  );
}

type RatingProps = {
  label: string;
  value: number | null;
  onSelect: (value: number) => void;
  onClear: () => void;
};

function Rating({ label, value, onSelect, onClear }: RatingProps) {
  const scale = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{label}</Text>
        {value !== null ? <ClearButton onPress={onClear} /> : null}
      </View>
      <View style={styles.ratingRow}>
        {scale.map((rating) => (
          <Pressable
            key={rating}
            style={[styles.ratingCircle, value === rating && styles.ratingCircleActive]}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === rating }}
            accessibilityLabel={`${label} ${rating} of ${RATING_MAX}`}
            onPress={() => onSelect(rating)}
          >
            <Text style={[styles.ratingText, value === rating && styles.ratingTextActive]}>
              {rating}
            </Text>
          </Pressable>
        ))}
      </View>
      {value === null ? <Text style={styles.notAnsweredInline}>Not answered</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 220, gap: spacing.lg },
  completionSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  completionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  completionTitle: { color: colors.text },
  prPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 32,
  },
  prPillText: { ...typography.label, color: colors.primaryText },
  completionStatsRow: { flexDirection: "row", gap: spacing.sm },
  completionStat: {
    flex: 1,
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.nested,
    padding: spacing.md,
  },
  completionValue: { ...typography.heading, color: colors.text },
  completionLabel: { ...typography.label, color: colors.textSecondary, marginTop: spacing.xs },
  prCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.nested,
    padding: spacing.md,
  },
  prCalloutText: { flex: 1, ...typography.label, color: colors.text },

  optionalNote: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: "center",
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { ...typography.heading, color: colors.text },
  cardHint: { ...typography.label, color: colors.textSecondary, marginTop: -spacing.md },
  clearButton: { minHeight: touchTarget.min, justifyContent: "center", paddingStart: spacing.md },
  clearButtonText: { ...typography.label, color: colors.textSecondary },

  ratingRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  ratingCircle: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingCircleActive: { backgroundColor: colors.primary },
  ratingText: { ...typography.bodyStrong, color: colors.textSecondary },
  ratingTextActive: { color: colors.primaryText },
  notAnswered: { ...typography.body, color: colors.textTertiary },
  notAnsweredInline: { ...typography.label, color: colors.textTertiary, textAlign: "center" },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  stepperButton: {
    width: touchTarget.comfortable,
    height: touchTarget.comfortable,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValueBox: { alignItems: "center", minWidth: 110 },
  stepperValue: { ...typography.metric, color: colors.text },
  stepperUnit: { ...typography.label, color: colors.textSecondary },

  areaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  areaChip: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInset,
  },
  areaChipActive: { backgroundColor: colors.primary },
  areaLabel: { ...typography.label, color: colors.textSecondary },
  areaLabelActive: { color: colors.primaryText },

  painRow: { flexDirection: "row", gap: spacing.md },
  painChoice: {
    flex: 1,
    minHeight: touchTarget.large,
    borderRadius: radius.nested,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
  },
  /*
   * "No" confirms in neutral white, not green — a green tick for "nothing
   * hurts" would make the honest answer feel like the correct one. "Yes" is
   * amber: it needs the coach's attention, but the client did nothing wrong.
   */
  painChoiceActiveNo: { backgroundColor: colors.surface },
  painChoiceActiveYes: { backgroundColor: colors.warningMuted },
  painChoiceText: { ...typography.button, color: colors.textSecondary },
  painChoiceTextActive: { color: colors.text },
  painInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.nested,
    padding: spacing.lg,
    minHeight: 88,
    textAlignVertical: "top",
  },
  validationText: { ...typography.label, color: colors.warning },

  finishBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.nested,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  finishBtnBlocked: { backgroundColor: colors.surfaceInset },
  finishBtnText: { ...typography.button, color: colors.primaryText },
  cancelLink: { alignItems: "center", minHeight: touchTarget.large, justifyContent: "center" },
  cancelLinkText: { ...typography.body, color: colors.textSecondary },
});
