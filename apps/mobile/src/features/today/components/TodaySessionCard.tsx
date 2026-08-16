import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../../components/Typography";
import { Surface } from "../../../components/Surface";
import { colors } from "../../../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../../../theme/tokens";
import type { TodayState } from "../todayState";

type Props = {
  state: TodayState;
  /** Named when a coach is assigned, so the plan reads as coming from a person. */
  coachName?: string | null;
  onStart: () => void;
  onRetry?: () => void;
};

/**
 * The one thing today is about.
 *
 * This replaces the top of a screen that showed nine sibling cards at one
 * elevation, where the single most important line — what to do next — competed
 * with a stats ring, a mission tracker and three plan cards for the same
 * attention. The design's answer is that the trainee asks one question in the
 * morning, so one surface answers it.
 *
 * It carries the screen's ONLY accent fill, and only when there is an action to
 * take. A finished day, a rest day and a failed read all render flat: they are
 * reports, and spending the accent on a report is what made the old screen's
 * yellow meaningless.
 */
export function TodaySessionCard({ state, coachName, onStart, onRetry }: Props) {
  if (state.kind === "loading") {
    return (
      <Surface style={styles.flatCard}>
        <View style={styles.row}>
          <ActivityIndicator size="small" color={colors.textTertiary} />
          <Typography variant="body" color={colors.textTertiary}>
            Loading today's plan…
          </Typography>
        </View>
      </Surface>
    );
  }

  if (state.kind === "unavailable") {
    /*
     * A failed read, stated as a failure. The old screen rendered the same
     * empty plan cards it renders for a client with no plan, so a network drop
     * was indistinguishable from a coach who had not written anything yet.
     */
    return (
      <Surface style={styles.flatCard}>
        <View style={styles.row}>
          <Ionicons name="alert-circle-outline" size={iconSize.md} color={colors.warning} />
          <View style={styles.grow}>
            <Typography variant="bodyStrong" color={colors.warning}>
              Unavailable — could not load
            </Typography>
            <Typography variant="label" color={colors.textTertiary}>
              This is not the same as having no plan.
            </Typography>
          </View>
          {onRetry ? (
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry loading today's plan"
              style={styles.retry}
            >
              <Typography variant="label" color={colors.warning}>Retry</Typography>
            </Pressable>
          ) : null}
        </View>
      </Surface>
    );
  }

  if (state.kind === "session_logged") {
    return (
      <Surface style={styles.flatCard}>
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={iconSize.lg} color={colors.success} />
          <View style={styles.grow}>
            <Typography variant="h2">
              {state.sessions > 1 ? `${state.sessions} sessions logged` : "Session logged"}
            </Typography>
            <Typography variant="label" color={colors.textSecondary}>
              {coachName ? `${coachName} can see it.` : "That's today done."}
            </Typography>
          </View>
        </View>
      </Surface>
    );
  }

  if (state.kind === "rest_day") {
    return (
      <Surface style={styles.flatCard}>
        <View style={styles.row}>
          <Ionicons name="moon-outline" size={iconSize.lg} color={colors.textSecondary} />
          <View style={styles.grow}>
            <Typography variant="h2">Rest day</Typography>
            {/*
              Says why there is nothing here. Silence on a rest day otherwise
              reads as a bug — the app having lost the plan.
            */}
            <Typography variant="label" color={colors.textSecondary}>
              Nothing to train. Your program has today off.
            </Typography>
          </View>
        </View>
      </Surface>
    );
  }

  // ---- The two states that carry the accent -------------------------------
  const isPlanned = state.kind === "session_planned";
  const kicker = isPlanned
    ? state.fromCoach && coachName
      ? `Today's session · from ${coachName}`
      : "Today's session"
    : "Nothing planned for today";
  const title = isPlanned ? state.title : "Log a workout";
  const detail = isPlanned
    ? [
        state.exerciseCount !== null ? `${state.exerciseCount} exercises` : null,
        state.loggedSessions > 0
          ? `${state.loggedSessions} ${state.loggedSessions === 1 ? "session" : "sessions"} already logged`
          : null,
      ].filter(Boolean).join(" · ")
    : "No plan reaches today. You can still train and log it.";

  return (
    <View style={styles.accentCard}>
      <Typography variant="label" style={styles.kicker}>{kicker}</Typography>
      <Typography variant="h1" style={styles.accentTitle}>{title}</Typography>
      {detail ? (
        <Typography variant="body" style={styles.accentDetail}>{detail}</Typography>
      ) : null}
      <Pressable
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel={isPlanned ? "Start the session" : "Log a workout"}
        style={styles.accentButton}
      >
        <Typography variant="button" color={colors.primary}>
          {isPlanned ? "Start the session" : "Log a workout"}
        </Typography>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flatCard: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1, gap: 2 },
  retry: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.nested,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  accentCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  /*
   * On-accent text. The old action card used rgba(0,0,0,0.5) at 10px — 3.6:1,
   * below the 4.5:1 that size needs. 0.72 clears it at the same weight.
   */
  kicker: { color: "rgba(0,0,0,0.72)" },
  accentTitle: { color: colors.primaryText },
  accentDetail: { color: "rgba(0,0,0,0.72)" },
  accentButton: {
    marginTop: spacing.md,
    minHeight: touchTarget.large,
    borderRadius: radius.nested,
    backgroundColor: colors.primaryText,
    alignItems: "center",
    justifyContent: "center",
    ...typography.button,
  },
});
