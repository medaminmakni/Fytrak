import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { iconSize, spacing, typography } from "../../../../theme/tokens";
import type { DataStatus } from "../../../../hooks/useTraineeDetailData";

/*
 * The hook's own status type, imported rather than redeclared. A local
 * `"idle" | "ready"` union here would be a second vocabulary for the same three
 * states, and the two would drift the first time either changed.
 */
type DimensionValueProps = {
  status: DataStatus;
  /** True when the read succeeded and the client genuinely logged nothing. */
  isEmpty: boolean;
  /** What to show when there IS data. */
  children: React.ReactNode;
  /** Overrides "Nothing logged" for dimensions where the noun matters. */
  emptyLabel?: string;
};

/**
 * Three outcomes, three sentences.
 *
 * "Nothing logged" and "could not load" are opposite conclusions that used to
 * look identical — a failed read rendered as an empty value, so a coach reading
 * a client's day could not tell whether the client skipped their session or
 * whether the app simply failed to fetch it. One of those means send a message;
 * the other means try again. They now read differently and are coloured
 * differently.
 *
 * The screen already had a summary banner at the bottom listing failed
 * sections. That is too late and too far away — by the time the coach reaches
 * it they have already read the zeros above as fact.
 */
export function DimensionValue({ status, isEmpty, children, emptyLabel }: DimensionValueProps) {
  if (status === "error") {
    return (
      <View style={styles.row}>
        <Ionicons name="alert-circle-outline" size={iconSize.sm} color={colors.warning} />
        <Text style={styles.unknown}>Unavailable — could not load</Text>
      </View>
    );
  }

  if (status === "loading") {
    // A spinner scoped to THIS section. The screen no longer gates the whole
    // report behind one indicator, so each dimension shows its own progress
    // and the sections that have arrived stay readable while it spins.
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
        <Text style={styles.pending}>Loading…</Text>
      </View>
    );
  }

  if (isEmpty) {
    return <Text style={styles.empty}>{emptyLabel ?? "Nothing logged"}</Text>;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  /*
   * Amber, not red. A failed read is not a failing client — colouring it red
   * would put a client who logged perfectly next to the same signal as one who
   * did nothing.
   */
  unknown: {
    ...typography.label,
    color: colors.warning,
  },
  /* Grey and neutral. Absence is a state, not a problem. */
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pending: {
    ...typography.body,
    color: colors.textTertiary,
  },
});
