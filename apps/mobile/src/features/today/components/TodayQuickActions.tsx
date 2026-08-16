import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { colors } from "../../../theme/colors";
import { iconSize, radius, spacing } from "../../../theme/tokens";

export type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

type Props = { actions: QuickAction[] };

/**
 * The three things a trainee does outside a session.
 *
 * Deliberately NOT cards. The old screen made every one of these a full-width
 * bordered container at the same elevation as the day's plan, which is how nine
 * siblings ended up competing for one attention. These are controls: equal to
 * each other, subordinate to the session above them, and separated by space
 * rather than by outlines.
 */
export function TodayQuickActions({ actions }: Props) {
  if (actions.length === 0) return null;

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Ionicons name={action.icon} size={iconSize.lg} color={colors.text} />
          <Typography variant="label" color={colors.textSecondary} numberOfLines={1}>
            {action.label}
          </Typography>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1,
    // 72pt tall, per the design. Comfortably above the 44 minimum.
    height: 72,
    borderRadius: radius.nested,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  actionPressed: { backgroundColor: colors.surfaceInset },
});
