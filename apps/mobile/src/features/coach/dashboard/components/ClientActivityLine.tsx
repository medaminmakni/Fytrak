import { StyleSheet, Text } from "react-native";
import { colors } from "../../../../theme/colors";
import { typography } from "../../../../theme/tokens";
import type { ClientActivityState } from "../../../coaching/coachIntelligence";

/**
 * The one fact a coach scans a roster for: how long has this client been quiet?
 *
 * One coloured line per row, so scanning down a list reads as a gradient of
 * urgency rather than a wall of pills. The words carry the meaning — colour is
 * a second, redundant cue, never the signal itself.
 *
 * `never_logged` is deliberately NOT a warning. A client who joined yesterday
 * has not gone quiet; they have not started. Colouring that red tells the coach
 * something false about a perfectly normal state.
 */
export function formatClientActivity(state: ClientActivityState): string {
  switch (state.kind) {
    case "logged_today":
      // No "· 2h ago". That detail came from elapsed-time maths, which is the
      // very thing that made a 23:00 session read as today at 01:00.
      return "Logged today";
    case "logged_recently":
      return state.daysAgo === 1 ? "Logged yesterday" : `Logged ${state.daysAgo} days ago`;
    case "silent":
      return `Silent ${state.daysAgo} days`;
    case "never_logged":
      return "No logs yet";
    case "unknown":
      // The client's timezone was never captured, so we cannot say which of
      // THEIR days the session belongs to. Saying "silent 3 days" from the
      // coach's clock would be a guess about someone else's week.
      return "Last log — date unknown";
  }
}

function toneFor(state: ClientActivityState) {
  switch (state.kind) {
    case "logged_today":
      return styles.active;
    case "silent":
      return state.daysAgo >= 7 ? styles.overdue : styles.due;
    case "unknown":
      return styles.neutral;
    default:
      return styles.neutral;
  }
}

export function ClientActivityLine({ state }: { state: ClientActivityState }) {
  return (
    <Text style={[styles.base, toneFor(state)]} numberOfLines={1}>
      {formatClientActivity(state)}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    ...typography.label,
  },
  active: {
    color: colors.success,
  },
  due: {
    color: colors.warning,
  },
  overdue: {
    color: colors.danger,
  },
  neutral: {
    color: colors.textSecondary,
  },
});
