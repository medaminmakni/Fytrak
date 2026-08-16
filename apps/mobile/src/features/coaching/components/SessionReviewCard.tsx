import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { Surface } from "../../../components/Surface";
import { colors } from "../../../theme/colors";
import { iconSize, spacing } from "../../../theme/tokens";
import type { SessionReview } from "../sessionReview";

type Props = {
  review: SessionReview;
  /** Shown above the rows, e.g. "Session 1 of 2". */
  sessionLabel?: string;
  /**
   * The source that can be proven for this log.
   *
   * Read from the log's own source metadata. Without it a coach cannot tell a
   * client's extra session from the one they prescribed — both appear on the
   * same day and look identical.
   */
  sourceLabel?: string;
};

/**
 * How the session went, against what was asked.
 *
 * Summary depth, not per-set: a coach deciding the next session needs to see
 * where the plan and the day diverged, and a full set-by-set dump buries that
 * under numbers they already trust the client to have entered.
 *
 * Nothing here is scored. Every line is either a pair of figures or a name, and
 * the one place a judgement would naturally go — a completion percentage — is
 * deliberately absent. "13 of 18 sets" and "Overhead press not done" are things
 * a coach can act on; 72% is a grade that hides which four sets went missing.
 */
export function SessionReviewCard({ review, sessionLabel, sourceLabel }: Props) {
  if (review.rows.length === 0 && review.notDone.length === 0) return null;

  return (
    <Surface style={styles.card}>
      <View style={styles.headerRow}>
        <Typography variant="h2">How it went</Typography>
        {sourceLabel ? (
          <Typography variant="label" color={colors.textSecondary}>{sourceLabel}</Typography>
        ) : null}
        {sessionLabel ? (
          <Typography variant="label" color={colors.textTertiary}>{sessionLabel}</Typography>
        ) : null}
      </View>

      {/*
        Session-wide RPE stands ALONE. The design pairs it with "vs 8 asked",
        but prescriptions carry no target RPE, so there is nothing to compare
        against and a delta would have to be invented.
      */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCell}>
          <Typography variant="label" color={colors.textSecondary}>SETS DONE</Typography>
          <Typography variant="bodyStrong" style={styles.figure}>
            {review.totalPlannedSets !== null
              ? `${review.totalCompletedSets} of ${review.totalPlannedSets}`
              : String(review.totalCompletedSets)}
          </Typography>
        </View>
        <View style={styles.summaryCell}>
          <Typography variant="label" color={colors.textSecondary}>AVG RPE</Typography>
          {review.averageRpe !== null ? (
            <Typography variant="bodyStrong" style={styles.figure}>
              {review.averageRpe}
              <Typography variant="label" color={colors.textTertiary}>
                {` · ${review.ratedSets} rated`}
              </Typography>
            </Typography>
          ) : (
            /* Not rated is not zero. */
            <Typography variant="label" color={colors.textTertiary}>Not rated</Typography>
          )}
        </View>
      </View>

      {review.rows.map((row) => (
        <View key={row.name} style={styles.exerciseRow}>
          <View style={styles.grow}>
            <Typography variant="bodyStrong" numberOfLines={1}>{row.name}</Typography>
            <Typography variant="label" color={colors.textSecondary}>
              {row.plannedSets !== null
                ? `${row.completedSets} of ${row.plannedSets} sets${row.plannedReps ? ` · asked ${row.plannedReps}` : ""}`
                : `${row.completedSets} sets · not planned`}
              {row.topWeight !== null ? ` · top ${row.topWeight}kg` : ""}
            </Typography>
          </View>
          <Typography
            variant="bodyStrong"
            color={row.averageRpe !== null ? colors.text : colors.textTertiary}
            style={styles.figure}
          >
            {row.averageRpe !== null ? `RPE ${row.averageRpe}` : "—"}
          </Typography>
        </View>
      ))}

      {/*
        Named, not counted. "One exercise missed" tells a coach nothing;
        "Overhead press" tells them what to ask about.
      */}
      {review.notDone.length > 0 ? (
        <View style={styles.notDoneRow}>
          <Ionicons name="remove-circle-outline" size={iconSize.sm} color={colors.textSecondary} />
          <Typography variant="label" color={colors.textSecondary} style={styles.grow}>
            Not done: {review.notDone.join(", ")}
          </Typography>
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  summaryRow: { flexDirection: "row", gap: spacing.sm },
  summaryCell: { flex: 1, gap: 2 },
  figure: { fontVariant: ["tabular-nums"] },
  exerciseRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  notDoneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
