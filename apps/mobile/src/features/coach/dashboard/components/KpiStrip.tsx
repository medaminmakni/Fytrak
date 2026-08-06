import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../../../theme/colors";
import { radius, spacing, typography } from "../../../../theme/tokens";

type Props = {
  totalClients: number;
  activeClients: number;
  /** Average logging-consistency score across the roster. See the note below. */
  consistency: number;
  followUpsDue: number;
};

/**
 * Four numbers, four flat tiles.
 *
 * The third one used to be labelled "Compliance", which it is not. The score it
 * shows is `complianceScore` from coachIntelligence: 55 points for workouts
 * logged, 25 for meals *logged* (a count, not a comparison against targets),
 * and 20 for protein — which defaults to 12 free points when the client has no
 * protein target at all. So a client eating well over their calories can score
 * highly, and calling that "adherence" tells the coach something untrue about
 * their roster. It measures how consistently clients LOG, so it says so.
 */
export function KpiStrip({ totalClients, activeClients, consistency, followUpsDue }: Props) {
  const items = [
    { key: "clients", label: "Clients", value: String(totalClients) },
    { key: "active", label: "Active", value: String(activeClients) },
    { key: "logging", label: "Logging", value: `${consistency}%` },
    { key: "due", label: "Due", value: String(followUpsDue) },
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
