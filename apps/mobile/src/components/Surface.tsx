import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/tokens";

/**
 * The one card in the app.
 *
 * Four parallel definitions of this object used to exist (trainee Home,
 * Nutrition summary, the coach dashboard, trainee Detail) plus WaterTracker's
 * own set of values that appeared nowhere else. They drifted on radius,
 * padding, background and border, so nothing on screen agreed on what a card
 * was. Everything now routes through here.
 *
 * There are two levels and no others. `flat` is every card; `inset` is a region
 * nested inside one. Neither has a border — separation comes from the surface
 * step. The seven-tone version of this component (accent/success/warning/danger
 * washes) is gone: those were used to mark categories, which is what titles and
 * icons are for, and four of the seven had no call sites at all.
 */
export type SurfaceLevel = "flat" | "inset";

type SurfaceProps = PropsWithChildren<{
  level?: SurfaceLevel;
  /**
   * @deprecated Use `level`. Both remaining values render as `flat`; replace
   * `tone="muted"` with `level="inset"` only where the card is genuinely nested
   * inside another surface.
   */
  tone?: "default" | "muted";
  /** The coach dashboard's tighter row geometry — the one legitimate variation. */
  density?: "default" | "compact";
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}>;

export function Surface({
  level = "flat",
  density = "default",
  padded = true,
  style,
  accessibilityLabel,
  children,
}: SurfaceProps) {
  return (
    <View
      style={[
        styles[level],
        density === "compact" && styles.compact,
        padded && (density === "compact" ? styles.paddedCompact : styles.padded),
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flat: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  },
  inset: {
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.nested,
  },
  compact: {
    borderRadius: radius.nested,
  },
  padded: {
    padding: spacing.xl,
  },
  paddedCompact: {
    padding: spacing.lg,
  },
});
