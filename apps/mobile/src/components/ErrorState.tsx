import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { iconSize, radius, spacing } from "../theme/tokens";
import { Typography } from "./Typography";
import { PrimaryButton } from "./Button";

type ErrorStateProps = {
  /** What the user was trying to see, in their words. "We couldn't load your meals." */
  title: string;
  /** What they can do about it. Keep it short and non-technical. */
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Set while a retry is in flight so the button cannot be pressed twice. */
  retrying?: boolean;
};

/**
 * The failure counterpart to EmptyState.
 *
 * These two are not interchangeable and the distinction matters more here than
 * in most apps: "you have logged nothing today" and "we could not read what you
 * logged today" look identical if a failed read renders as an empty list, and a
 * coach acting on the second thinking it is the first will draw the wrong
 * conclusion about their client.
 *
 * Never pass a raw exception into `message`.
 */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = "Try again",
  retrying = false,
}: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={iconSize.lg} color={colors.danger} />
      </View>
      <Typography variant="h2" style={styles.centered}>
        {title}
      </Typography>
      {message ? (
        <Typography variant="body" color={colors.textSecondary} style={styles.message}>
          {message}
        </Typography>
      ) : null}
      {onRetry ? (
        <PrimaryButton
          title={retryLabel}
          onPress={onRetry}
          variant="secondary"
          icon="refresh"
          loading={retrying}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["3xl"],
    gap: spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    maxWidth: 280,
  },
  action: {
    minWidth: 180,
    marginTop: spacing.sm,
  },
});
