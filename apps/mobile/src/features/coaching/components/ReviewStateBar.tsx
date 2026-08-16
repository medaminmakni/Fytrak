import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../../../theme/tokens";
import type { DailyReportReviewStatus } from "../../../services/dailyReportService";
import type { DashboardIcon } from "../../coach/dashboard/components/dashboardTypes";

type ReviewStateBarProps = {
  /** `null` when the read succeeded and the client logged nothing that day. */
  status: DailyReportReviewStatus | null;
  /**
   * True while the report listener has not answered yet.
   *
   * Without this, `status` was `null` both before the first snapshot and after
   * one that found no document, so the bar asserted "Nothing logged this day"
   * about a day it had not finished reading.
   */
  isLoading?: boolean;
  /** Set when the read itself failed — a different thing from `null`. */
  hasError: boolean;
  isBusy: boolean;
  onMarkReviewed: () => void;
};

type StateCopy = {
  icon: DashboardIcon;
  tint: string;
  label: string;
  /** Absent when there is nothing for the coach to do from here. */
  action?: string;
};

/**
 * Where this day sits in the coach's workflow, and the one action it implies.
 *
 * Five states, not three-plus-a-suffix:
 *
 * - `live`      the day is still running; reviewing it would be premature
 * - `pending`   the day closed and nobody has read it
 * - `reviewed`  read, and nothing has changed since
 * - `reopened`  read, then the client logged again — the conclusion is stale
 * - `unknown`   the client's timezone is missing, so we cannot time the review
 *
 * `reopened` is the one that was invisible. It derived as `pending_review` while
 * the screen only rendered its label on the `reviewed` branch, so a late log
 * landing after a coach closed a day looked identical to a day never opened.
 *
 * `unknown` is deliberately dull and deliberately actionless. The bar previously
 * could not reach it because the derivation fell back to the coach's device
 * timezone rather than admitting it did not know — which produced a confident
 * `pending_review` or `live` that was simply wrong for any client in another
 * zone. Offering "Mark reviewed" here would invite a coach to close a day that
 * may still be running.
 *
 * Only ONE of these carries the accent surface. Yellow marks the single next
 * action on a screen, and on a client's day that is clearing a review — never
 * the state label itself, and never a day that is already done.
 */
const COPY: Record<DailyReportReviewStatus, StateCopy> = {
  live: {
    icon: "ellipse-outline",
    tint: colors.textSecondary,
    label: "Live — day not finished",
  },
  pending_review: {
    icon: "time-outline",
    tint: colors.warning,
    label: "Pending your review",
    action: "Mark reviewed",
  },
  reviewed: {
    icon: "checkmark-circle",
    tint: colors.success,
    label: "Reviewed",
  },
  reopened: {
    icon: "refresh-circle",
    tint: colors.warning,
    label: "Reviewed · reopened since",
    action: "Review again",
  },
  unknown: {
    // Muted and neutral: this is an absence of information, not a warning. No
    // `action` key, so no button renders — there is nothing safe to do here.
    icon: "help-circle-outline",
    tint: colors.textSecondary,
    label: "Review timing unavailable",
  },
};

export function ReviewStateBar({
  status,
  isLoading = false,
  hasError,
  isBusy,
  onMarkReviewed,
}: ReviewStateBarProps) {
  // Error first: a listener that failed is not still loading.
  if (hasError) {
    return (
      <View style={styles.bar}>
        <Ionicons name="alert-circle-outline" size={iconSize.md} color={colors.warning} />
        <Text style={[styles.label, { color: colors.warning }]}>Review status unavailable</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.bar}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
        <Text style={styles.label}>Loading review status…</Text>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.bar}>
        <Ionicons name="ellipse-outline" size={iconSize.md} color={colors.textSecondary} />
        {/* A real answer, not a failure. Nothing to review because nothing happened. */}
        <Text style={styles.label}>Nothing logged this day</Text>
      </View>
    );
  }

  const copy = COPY[status];

  return (
    <View style={styles.bar}>
      <Ionicons name={copy.icon} size={iconSize.md} color={copy.tint} />
      <Text style={[styles.label, { color: copy.tint }]} numberOfLines={2}>
        {copy.label}
      </Text>

      {copy.action ? (
        <Pressable
          style={[styles.action, isBusy && styles.actionBusy]}
          accessibilityRole="button"
          accessibilityLabel={copy.action}
          accessibilityState={{ disabled: isBusy, busy: isBusy }}
          disabled={isBusy}
          onPress={onMarkReviewed}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <Text style={styles.actionLabel}>{copy.action}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.textSecondary,
    flex: 1,
  },
  action: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.nested,
    backgroundColor: colors.primary,
  },
  actionBusy: {
    backgroundColor: colors.surfaceInset,
  },
  actionLabel: {
    ...typography.button,
    color: colors.primaryText,
  },
});
