import { StyleSheet, View } from "react-native";
import { Typography } from "../../../components/Typography";
import { Surface } from "../../../components/Surface";
import { colors } from "../../../theme/colors";
import { radius, spacing } from "../../../theme/tokens";

type Target = {
  label: string;
  current: number;
  /** Null when the trainee has no target for this macro. Never substituted. */
  target: number | null;
  unit: string;
};

type Props = {
  targets: Target[];
};

/**
 * Today's nutrition targets without claiming who authored them. The current
 * profile fields have no provenance, so assignment alone cannot prove that a
 * coach selected these values.
 *
 * No adherence percentage is computed. A bar shows a proportion of a real
 * target; it never becomes a score, and when there is no target there is no bar
 * — because the alternative is a bar filling against a denominator nobody set.
 */
export function TodayTargets({ targets }: Props) {
  const visible = targets.filter((t) => t.current > 0 || t.target !== null);
  if (visible.length === 0) return null;

  return (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <Typography variant="h2">Today's targets</Typography>
        <Typography variant="label" color={colors.textSecondary}>
          Available targets
        </Typography>
      </View>

      {visible.map((t) => {
        const hasTarget =
          typeof t.target === "number" && Number.isFinite(t.target) && t.target > 0;
        const progress = hasTarget
          ? Math.min(Math.max(t.current / (t.target as number), 0), 1)
          : 0;

        return (
          <View key={t.label} style={styles.row}>
            <View style={styles.rowHeader}>
              <Typography variant="body" color={colors.textSecondary}>{t.label}</Typography>
              <Typography variant="bodyStrong" style={styles.value}>
                {hasTarget
                  ? `${Math.round(t.current)} / ${t.target}${t.unit}`
                  : `${Math.round(t.current)}${t.unit} logged`}
              </Typography>
            </View>
            {/*
              The track renders only against a real target. With none there is
              no proportion to draw, and an empty bar reads as 0% rather than as
              "no target set".
            */}
            {hasTarget ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress * 100}%` }]} />
              </View>
            ) : (
              <Typography variant="label" color={colors.textTertiary}>
                No target set
              </Typography>
            )}
          </View>
        );
      })}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  row: { gap: spacing.xs },
  rowHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  value: { fontVariant: ["tabular-nums"] },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInset,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.primary },
});
