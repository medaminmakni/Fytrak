import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../../../../theme/tokens";
import type { DashboardIcon } from "./dashboardTypes";

export type PriorityCardData = {
  /** Small line above the headline: what kind of thing this is. */
  eyebrow: string;
  icon: DashboardIcon;
  /** The headline, phrased as the situation — "Sara wants to join". */
  title: string;
  /** One line of supporting fact. Never invent one; omit it instead. */
  detail?: string;
  actionLabel: string;
  onPress: () => void;
};

/**
 * The single next action on the coach's dashboard.
 *
 * This is the one raised surface in the app's elevation contract, and there is
 * exactly one per screen — if two things are raised, neither reads as the next
 * action. Everything else on this dashboard is flat.
 *
 * It renders only when there IS a next action. An "all clear" state does not
 * belong in a yellow card: reserving the loudest surface for good news teaches
 * the coach to stop reading it.
 */
export function PriorityCard({ eyebrow, icon, title, detail, actionLabel, onPress }: PriorityCardData) {
  return (
    <View style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Ionicons name={icon} size={iconSize.sm} color={colors.primaryText} />
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
      </View>

      <Text style={styles.title}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel}. ${title}`}
        style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      >
        <Text style={styles.actionLabel}>{actionLabel}</Text>
        <Ionicons name="arrow-forward" size={iconSize.md} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  /*
   * Black at 0.72 alpha, not `textSecondary`. The muted text steps are tuned
   * for contrast against `bg`; on the yellow fill they are unreadable.
   */
  eyebrow: {
    ...typography.label,
    color: "rgba(0, 0, 0, 0.72)",
    flexShrink: 1,
  },
  title: {
    ...typography.title,
    color: colors.primaryText,
  },
  detail: {
    ...typography.body,
    color: "rgba(0, 0, 0, 0.72)",
  },
  /*
   * A dark button on the yellow fill rather than another yellow one. The card
   * is already the accent; the control inside it has to invert to stay visible.
   */
  action: {
    marginTop: spacing.sm,
    minHeight: touchTarget.large,
    borderRadius: radius.nested,
    backgroundColor: colors.bg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  actionPressed: {
    backgroundColor: colors.surface,
  },
  actionLabel: {
    ...typography.button,
    color: colors.primary,
  },
});
