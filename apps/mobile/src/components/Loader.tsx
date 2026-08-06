import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { spacing, typography } from "../theme/tokens";

type LoaderProps = {
  /**
   * `screen` fills the available space — use it for a first load.
   * `inline` sits in the flow — use it for a section refreshing in place.
   */
  variant?: "screen" | "inline";
  /** Announced to screen readers. Defaults to a generic "Loading". */
  label?: string;
  /** Renders the label visibly as well. Worth it for waits over a second or so. */
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A loading indicator that says what it is.
 *
 * 41 bare `<ActivityIndicator>` elements were scattered across 30 files, none
 * of them labelled, so a screen reader announced nothing at all while the app
 * waited. This always carries an accessible label.
 */
export function Loader({
  variant = "screen",
  label = "Loading",
  showLabel = false,
  style,
}: LoaderProps) {
  return (
    <View
      style={[variant === "screen" ? styles.screen : styles.inline, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <ActivityIndicator size={variant === "screen" ? "large" : "small"} color={colors.primary} />
      {showLabel ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  inline: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
