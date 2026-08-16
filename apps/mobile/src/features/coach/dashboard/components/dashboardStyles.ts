import { StyleSheet } from "react-native";
import { colors } from "../../../../theme/colors";
import { radius, spacing, touchTarget, typography } from "../../../../theme/tokens";
import type { DashboardTone } from "./dashboardTypes";

/*
 * `dashboardColors` is gone.
 *
 * It was a second palette living beside the real one — its own `background`
 * (#0B0F14, a blue-tinted near-black that appears nowhere else in the app),
 * `surface`, `surfaceAlt`, `border` and `borderStrong`. Every screen that
 * imported it drifted away from the theme by definition, because the values
 * were never derived from it. The tone helpers below now read from `colors`,
 * so a change to the palette reaches the dashboard like everywhere else.
 */

export function toneColor(tone: DashboardTone): string {
  switch (tone) {
    case "danger":
      return colors.danger;
    case "warning":
      return colors.warning;
    case "info":
      return colors.info;
    case "success":
      return colors.success;
    default:
      return colors.textSecondary;
  }
}

export function toneBackground(tone: DashboardTone): string {
  switch (tone) {
    case "danger":
      return colors.dangerMuted;
    case "warning":
      return colors.warningMuted;
    case "success":
      return colors.successMuted;
    case "info":
      return "rgba(96, 165, 250, 0.16)";
    default:
      return colors.surfaceInset;
  }
}

/** Row primitives shared by every dashboard section. */
export const dashboardStyles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touchTarget.large,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  rowMeta: {
    ...typography.label,
    color: colors.textSecondary,
  },
  // Borderless, and square-ish rather than a circle so it reads as a monogram
  // tile and not a missing photo.
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.nested,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceInset,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillText: {
    ...typography.label,
  },
});
