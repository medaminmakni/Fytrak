import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../../../theme/colors";
import { radius, spacing, typography } from "../../../../theme/tokens";

type Props = {
  totalClients: number;
  /** Clients whose most recent workout log is today. */
  loggedToday: number;
  /** Clients with no log for three days or more. */
  silent: number;
};

/**
 * Four counts. Every one is something the app can prove.
 *
 * Two tiles were removed rather than relabelled:
 *
 * - "Logging 78%" (previously "Compliance"). That is `complianceScore`: 55
 *   points for workouts logged, 25 for meals *logged* — a count, never compared
 *   against a target — and 20 for protein, which pays 12 points for free when
 *   the client has no protein target. A client eating 4,000 kcal against 2,100
 *   scored highly. Renaming it did not make it true; it is gone.
 * - "Due". It was `atRiskClients.filter(risk === "high").length` — the same
 *   clients the silence count already covers, presented as a separate concern.
 *
 * Three tiles, not four.
 *
 * The design calls for "To review" in the third slot and it is the right
 * number — but it cannot be queried yet. `reviewStatus` is derived at read time
 * from `clientDateKey < today`, never stored, so Firestore has nothing to
 * filter on; `reviewAvailableAt` is read but never written. Counting it needs a
 * collection-group query on `coachId + reviewedAt + clientDateKey`, a new
 * index, and a rules change. "Silent 3d+" holds the slot until then because it
 * is provable today — it is not a stand-in that pretends to be the same thing.
 */
export function KpiStrip({ totalClients, loggedToday, silent }: Props) {
  const items = [
    { key: "clients", label: "Clients", value: String(totalClients) },
    { key: "logged", label: "Logged today", value: String(loggedToday) },
    { key: "silent", label: "Silent 3d+", value: String(silent) },
  ];

  return (
    <View style={styles.strip}>
      {items.map((item) => (
        <View
          key={item.key}
          style={styles.tile}
          accessible
          accessibilityLabel={`${item.value} ${item.label}`}
        >
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {item.value}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Four separate tiles rather than one bordered strip: the outline is gone,
  // so the gap between them is what separates them now.
  strip: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.nested,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  value: {
    ...typography.heading,
    color: colors.text,
    // Tabular figures so the row does not shift as counts change.
    fontVariant: ["tabular-nums"],
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
