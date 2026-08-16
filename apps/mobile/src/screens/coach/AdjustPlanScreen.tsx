import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenShell } from "../../components/ScreenShell";
import { TextField } from "../../components/TextField";
import { PrimaryButton } from "../../components/Button";
import { colors } from "../../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../../theme/tokens";
import {
  validateEffectiveDate,
  type AdjustablePlanKind,
} from "../../services/planRevisionService";
import {
  addDaysToDateKey,
  getForeignClientTodayDateKey,
  nextMondayDateKey,
} from "../../utils/dateKeys";

type EffectiveOption = {
  key: string;
  label: string;
  dateKey: string;
};

type KindOption = {
  key: AdjustablePlanKind | "program";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Programs cannot be adjusted in V0. Selectable, but not submittable. */
  disabled?: boolean;
};

const KINDS: KindOption[] = [
  { key: "workout", label: "Training", icon: "barbell-outline" },
  { key: "nutrition", label: "Nutrition", icon: "restaurant-outline" },
  { key: "program", label: "Program", icon: "calendar-outline", disabled: true },
];

const PROGRAM_NOTICE =
  "Program changes require assigning a new program. Existing program days are not rewritten.";

/**
 * The last step of the coaching loop — now one that actually changes something.
 *
 * WHAT WAS WRONG
 *
 * This screen called `createPlanRevision`, which wrote a single `planRevisions`
 * document, and then reported "Change recorded". No workout, meal plan or
 * program was altered anywhere. The coach believed the plan had changed; the
 * client saw exactly what they saw before. A success message with no write
 * behind it is worse than a missing feature, because nobody goes looking.
 *
 * WHAT IT DOES NOW
 *
 * It collects the decision — which dimension, which future day, and why — and
 * hands off to the existing prescription editor, where the coach authors the
 * actual replacement. The prescription and the revision are then written
 * together in one batch. This screen writes NOTHING itself.
 *
 * WHAT IT NO LONGER CLAIMS
 *
 * A daily prescription addresses exactly ONE client-local day, so the copy is
 * "schedule a replacement for" rather than "take effect from". It does not
 * recur, and it does not modify any later day. The old wording implied an
 * ongoing change the data model cannot express.
 *
 * The earliest date is TOMORROW in the client's calendar. Today is their day;
 * they may already have opened it or started training it.
 */
export function AdjustPlanScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const traineeId: string = route.params?.traineeId || "";
  const traineeName: string = route.params?.traineeName || "This client";
  const traineeTimezone: string | null = route.params?.traineeTimezone ?? null;

  const [kind, setKind] = useState<AdjustablePlanKind | "program">("workout");
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");

  /*
   * Options are built from the CLIENT's today, not the coach's. A coach in
   * London adjusting a client in Tunis must not be able to pick a day that has
   * already ended for the person who has to train it.
   *
   * "Today" is gone. A client may already have opened or started today's plan,
   * so replacing it would change something underneath them mid-session. The
   * earliest is tomorrow.
   */
  const options = useMemo<EffectiveOption[]>(() => {
    const clientToday = getForeignClientTodayDateKey(traineeTimezone);
    if (!clientToday) return [];
    const tomorrow = addDaysToDateKey(clientToday, 1);
    /*
     * A real week boundary, not `clientToday + 7`. Asked on a Friday, the old
     * arithmetic landed on a Friday and called it "In a week" — mid-week, which
     * is not when a training week starts. `nextMondayDateKey` returns the next
     * Monday, and from a Monday the one seven days later.
     */
    const nextMonday = nextMondayDateKey(clientToday);
    return [
      { key: "tomorrow", label: "Tomorrow", dateKey: tomorrow },
      ...(nextMonday === tomorrow
        // Asked on a Sunday, "next Monday" IS tomorrow. Two rows for one day
        // would let the coach pick the same date twice under two names.
        ? []
        : [{ key: "next-monday", label: "Next Monday", dateKey: nextMonday }]),
    ];
  }, [traineeTimezone]);

  const [effectiveKey, setEffectiveKey] = useState("tomorrow");
  const effective = options.find((option) => option.key === effectiveKey) ?? options[0];

  const dateCheck = effective
    ? validateEffectiveDate(effective.dateKey, traineeTimezone)
    : ({ ok: false, message: "This client's timezone is unknown." } as const);

  const isProgram = kind === "program";

  /*
   * Every route parameter this hand-off depends on is checked here, not at the
   * destination. A missing traineeId or timezone must stop the coach BEFORE
   * they author a replacement they cannot save.
   */
  const canContinue =
    !isProgram
    && Boolean(traineeId)
    && Boolean(effective)
    && dateCheck.ok
    && reason.trim().length > 0;

  /**
   * Hands the decision to the existing prescription editor.
   *
   * Nothing is written here. The revision is created in the same batch as the
   * prescription, at the end of that editor's save — so a coach who abandons
   * the form leaves no trace, which is the correct outcome for a change that
   * never happened.
   */
  const handleContinue = () => {
    if (!canContinue || !effective) return;
    const revision = {
      effectiveFromDateKey: effective.dateKey,
      reason: reason.trim(),
      summary: summary.trim(),
      traineeTimezone,
    };
    navigation.navigate(kind === "workout" ? "PrescribeWorkout" : "PrescribeMeal", {
      traineeId,
      traineeName,
      revision,
    });
  };

  return (
    <ScreenShell
      title="Adjust the plan"
      subtitle={traineeName}
      leftActionIcon="chevron-back"
      onLeftAction={() => navigation.goBack()}
      contentStyle={styles.shellContent}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What changes</Text>
          {/*
            Icons and titles carry the category. Nutrition is not green and
            programs are not red — colour here would mean "this is the food one"
            rather than a state.
          */}
          <View style={styles.kindRow}>
            {KINDS.map((option) => {
              const isActive = kind === option.key;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={option.label}
                  onPress={() => setKind(option.key)}
                  style={[
                    styles.kindChip,
                    isActive && styles.kindChipActive,
                    option.disabled && styles.kindChipUnsupported,
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={iconSize.md}
                    color={isActive ? colors.text : colors.textSecondary}
                  />
                  <Text style={[styles.kindLabel, isActive && styles.kindLabelActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/*
            Program stays visible and selectable so the answer to "can I change
            the program?" is on screen rather than discovered by its absence —
            but it cannot be submitted, and the notice says exactly why.
          */}
          {isProgram ? (
            <View style={styles.warning}>
              <Ionicons name="information-circle-outline" size={iconSize.sm} color={colors.warning} />
              <Text style={styles.warningText}>{PROGRAM_NOTICE}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          {/*
            "Schedule replacement for", not "Take effect from". A daily
            prescription is one day; the old wording promised an ongoing change
            the data model cannot express.
          */}
          <Text style={styles.sectionTitle}>Schedule replacement for</Text>
          <View style={styles.dateColumn}>
            {options.map((option) => {
              const isActive = effective?.key === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.dateRow, isActive && styles.dateRowActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={`${option.label}, ${option.dateKey}`}
                  onPress={() => setEffectiveKey(option.key)}
                >
                  <Ionicons
                    name={isActive ? "radio-button-on" : "radio-button-off"}
                    size={iconSize.md}
                    color={isActive ? colors.primary : colors.textTertiary}
                  />
                  <Text style={[styles.dateLabel, isActive && styles.dateLabelActive]}>
                    {option.label}
                  </Text>
                  {/* Both the human label and the stored key: the coach and the
                      client have to agree on which day this is. */}
                  <Text style={styles.dateKey}>{option.dateKey}</Text>
                </Pressable>
              );
            })}
          </View>

          {!dateCheck.ok ? (
            <View style={styles.warning}>
              <Ionicons name="alert-circle-outline" size={iconSize.sm} color={colors.warning} />
              <Text style={styles.warningText}>{dateCheck.message}</Text>
            </View>
          ) : null}
        </View>

        <TextField
          label="What you're changing"
          value={summary}
          onChangeText={setSummary}
          placeholder="Four sessions a week down to three"
          helperText="A short line the client will see with the change."
        />

        {/*
          Required, and the label says why. This is the `reason` on the record —
          the thing that makes a decision readable six weeks later.
        */}
        <TextField
          label="Why"
          required
          value={reason}
          onChangeText={setReason}
          placeholder="He's missed the Saturday session four weeks running."
          helperText="Saved with the change, so the history explains itself."
          multiline
          numberOfLines={3}
        />

        <View style={styles.lockNote}>
          <Ionicons name="lock-closed-outline" size={iconSize.sm} color={colors.textTertiary} />
          <Text style={styles.lockNoteText}>
            This replaces the plan for that one day only. Every other day stays exactly as it is,
            and the old plan remains on the record.
          </Text>
        </View>

        {/*
          "Next" rather than "Apply": nothing is saved from this screen. The
          coach still has to author the replacement, and the write happens
          there — atomically, with this revision attached.
        */}
        <PrimaryButton
          title={kind === "nutrition" ? "Create a revised nutrition plan" : "Create a revised workout"}
          onPress={handleContinue}
          disabled={!canContinue}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shellContent: { paddingBottom: 0 },
  scroll: { gap: spacing.xl, paddingBottom: spacing["4xl"], paddingTop: spacing.lg },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.heading, color: colors.text },
  kindRow: { flexDirection: "row", gap: spacing.sm },
  kindChip: {
    flex: 1,
    minHeight: touchTarget.large,
    borderRadius: radius.nested,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  // A surface step, not the accent. The accent on this screen is the commit.
  kindChipActive: { backgroundColor: colors.surfaceInset },
  kindChipUnsupported: { opacity: 0.6 },
  kindLabel: { ...typography.label, color: colors.textSecondary },
  kindLabelActive: { color: colors.text },
  dateColumn: { gap: spacing.xs },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touchTarget.large,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.nested,
    backgroundColor: colors.surface,
  },
  dateRowActive: { backgroundColor: colors.surfaceInset },
  dateLabel: { ...typography.body, color: colors.textSecondary, flex: 1 },
  dateLabelActive: { color: colors.text },
  dateKey: { ...typography.label, color: colors.textTertiary, fontVariant: ["tabular-nums"] },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warningMuted,
    borderRadius: radius.nested,
    padding: spacing.md,
  },
  warningText: { ...typography.label, color: colors.warning, flex: 1 },
  lockNote: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  lockNoteText: { ...typography.label, color: colors.textTertiary, flex: 1 },
});
