import { StyleSheet, View } from "react-native";
import { Typography } from "../../../../components/Typography";
import { colors } from "../../../../theme/colors";
import { radius, spacing } from "../../../../theme/tokens";
import {
  countFortnightStates,
  type FortnightDay,
  type FortnightDayState,
} from "../../../coaching/fortnight";

type Props = {
  days: FortnightDay[];
  /** Shown when the client's calendar is unknown, instead of an empty row. */
  emptyReason?: string;
};

/** Weekday initial, from the date key alone — no device calendar involved. */
const weekdayLetter = (dateKey: string): string => {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return ["S", "M", "T", "W", "T", "F", "S"][day] ?? "";
};

const CELL_STYLE: Record<FortnightDayState, { fill: string; label: string }> = {
  logged: { fill: colors.primary, label: "Logged" },
  planned_not_logged: { fill: colors.surfaceInset, label: "Planned, not logged" },
  rest: { fill: colors.surface, label: "Rest" },
  no_plan: { fill: colors.surface, label: "No plan" },
  future: { fill: "transparent", label: "" },
  unknown: { fill: colors.surface, label: "Unknown" },
};

/**
 * Fourteen days, and no score.
 *
 * The point of a strip over a percentage is shape: three misses in a row, or
 * every Saturday blank, is something a coach can act on. An adherence figure
 * averages exactly that away, which is why the design states plainly that
 * nothing is derived from these cells — and why the legend below carries raw
 * counts rather than a ratio.
 *
 * `no_plan` and `rest` share a fill deliberately. Neither is a miss, the
 * difference between them belongs to the day screen, and giving them separate
 * greys would invite reading one of them as worse than the other.
 */
export function FortnightStrip({ days, emptyReason }: Props) {
  if (days.length === 0) {
    return emptyReason ? (
      <Typography variant="label" color={colors.textTertiary}>{emptyReason}</Typography>
    ) : null;
  }

  const counts = countFortnightStates(days);
  const legend: string[] = [];
  if (counts.logged) legend.push(`${counts.logged} logged`);
  if (counts.planned_not_logged) legend.push(`${counts.planned_not_logged} planned, not logged`);
  if (counts.unknown) legend.push(`${counts.unknown} unknown`);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {days.map((day) => {
          const cell = CELL_STYLE[day.state];
          return (
            <View
              key={day.dateKey}
              style={styles.cellColumn}
              accessible
              accessibilityLabel={
                day.state === "future" ? `${day.dateKey}, not yet` : `${day.dateKey}, ${cell.label}`
              }
            >
              <View
                style={[
                  styles.cell,
                  { backgroundColor: cell.fill },
                  day.state === "future" && styles.cellFuture,
                ]}
              />
              <Typography variant="label" color={colors.textTertiary}>
                {weekdayLetter(day.dateKey)}
              </Typography>
            </View>
          );
        })}
      </View>

      {/*
        Raw tallies, never a ratio. "9 logged, 3 planned and not logged" is a
        description a coach can question; a percentage is a verdict.
      */}
      {legend.length > 0 ? (
        <Typography variant="label" color={colors.textSecondary}>
          {legend.join(" · ")}
        </Typography>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.xs },
  cellColumn: { flex: 1, alignItems: "center", gap: spacing.xs },
  cell: { width: "100%", height: 28, borderRadius: radius.nested },
  /* A day that has not happened is an outline, not a fill. */
  cellFuture: { borderWidth: 1, borderColor: colors.surfaceInset },
});
