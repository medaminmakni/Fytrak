import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { iconSize, radius, spacing, typography } from "../../../theme/tokens";
import { readCheckIn, SORE_AREA_LABEL, type StoredCheckIn } from "../../workouts/checkIn";

type SessionCheckInCardProps = {
  checkIn: StoredCheckIn | undefined;
  /** Shown when a client logged more than one session on the day. */
  sessionLabel?: string;
};

/**
 * The post-session check-in, on the coach's side.
 *
 * The distinction this card exists to preserve: a value the client gave, a
 * question they left blank, and a read that failed are three different things.
 * This component only ever renders the first two — a failed read is the
 * caller's job, because "not answered" and "could not load" lead a coach to
 * opposite conclusions.
 *
 * Nothing is scored. Facts and a flag; the coach decides.
 */
export function SessionCheckInCard({ checkIn, sessionLabel }: SessionCheckInCardProps) {
  const model = readCheckIn(checkIn);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>How it felt</Text>
        {sessionLabel ? <Text style={styles.sessionLabel}>{sessionLabel}</Text> : null}
      </View>

      {!model.answered ? (
        // A session saved without the check-in, or one logged before the
        // check-in existed. Neither means "they felt fine".
        <Text style={styles.absent}>Not answered</Text>
      ) : (
        <>
          {/*
            Pain sits above everything else. It is the one line that can change
            today's decision, and under three ratings it gets skimmed past.
          */}
          {model.painFlagged === true ? (
            <View style={styles.painBanner}>
              <Ionicons name="alert-circle" size={iconSize.md} color={colors.warning} />
              <View style={styles.painCopy}>
                <Text style={styles.painTitle}>Pain reported</Text>
                {model.painNote ? <Text style={styles.painNote}>“{model.painNote}”</Text> : null}
              </View>
            </View>
          ) : null}

          <View style={styles.grid}>
            <Metric label="Energy" value={model.energy === null ? null : `${model.energy}/5`} />
            <Metric label="Mood" value={model.mood === null ? null : `${model.mood}/5`} />
            <Metric
              label="Sleep"
              value={model.sleepHours === null ? null : `${model.sleepHours}h`}
            />
          </View>

          {model.soreAreas.length > 0 ? (
            <View style={styles.soreBlock}>
              <Text style={styles.soreLabel}>Sore</Text>
              <View style={styles.soreRow}>
                {model.soreAreas.map((area) => (
                  <View key={area} style={styles.soreChip}>
                    <Text style={styles.soreChipText}>{SORE_AREA_LABEL[area]}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : model.legacySoreness !== null ? (
            /*
             * Documents written before body areas existed carry a 1-5 score.
             * Labelled as the old measure rather than silently shown as if it
             * were the same question — it says how much, never where.
             */
            <View style={styles.soreBlock}>
              <Text style={styles.soreLabel}>Soreness (older format)</Text>
              <Text style={styles.legacyValue}>{model.legacySoreness}/5 — no area recorded</Text>
            </View>
          ) : null}

          {model.painFlagged === false ? (
            <Text style={styles.noPain}>No pain reported</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  const unanswered = value === null;
  return (
    <View
      style={styles.metric}
      accessible
      accessibilityLabel={`${label} ${unanswered ? "not answered" : value}`}
    >
      <Text style={[styles.metricValue, unanswered && styles.metricUnanswered]}>
        {unanswered ? "—" : value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.heading, color: colors.text },
  sessionLabel: { ...typography.label, color: colors.textSecondary },
  absent: { ...typography.body, color: colors.textSecondary },
  /*
   * Amber, not red. A client reporting pain is doing exactly the right thing —
   * red would frame an honest answer as a failure.
   */
  painBanner: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.warningMuted,
    borderRadius: radius.nested,
    padding: spacing.lg,
  },
  painCopy: { flex: 1, gap: spacing.xs },
  painTitle: { ...typography.bodyStrong, color: colors.warning },
  painNote: { ...typography.body, color: colors.text },
  grid: { flexDirection: "row", gap: spacing.sm },
  metric: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.nested,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  metricValue: {
    ...typography.bodyStrong,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  metricUnanswered: { color: colors.textTertiary },
  metricLabel: { ...typography.label, color: colors.textSecondary },
  soreBlock: { gap: spacing.sm },
  soreLabel: { ...typography.label, color: colors.textSecondary },
  soreRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  soreChip: {
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  soreChipText: { ...typography.label, color: colors.text },
  legacyValue: { ...typography.body, color: colors.textSecondary },
  noPain: { ...typography.label, color: colors.textSecondary },
});
