import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../../../theme/colors";
import { spacing, touchTarget, typography } from "../../../../theme/tokens";

type DashboardSectionProps = PropsWithChildren<{
  title: string;
  /** One line under the heading saying what the list is ordered by, or why. */
  subtitle?: string;
  /** A trailing link, e.g. "See all". Rendered only with `onAction`. */
  actionLabel?: string;
  onAction?: () => void;
  /** Shown in place of `children` when the section has nothing to list. */
  emptyText?: string;
  isEmpty?: boolean;
}>;

/**
 * One section of the coach dashboard: a heading, then rows.
 *
 * All four sections used to build this themselves — each wrapped in a card,
 * each with its own copy of `sectionHeader` / `sectionCopy` / `eyebrow` /
 * `title` / `list`, and each with a two-line heading where the eyebrow said
 * roughly what the title said ("Critical insight" over "At-risk clients",
 * "Roster preview" over "Clients"). One heading, defined once.
 *
 * Sections are not cards. Four stacked cards on one scroll makes every section
 * look equally important, which defeats the point of having a raised card at
 * the top; 32px of space separates them instead.
 */
export function DashboardSection({
  title,
  subtitle,
  actionLabel,
  onAction,
  emptyText,
  isEmpty = false,
  children,
}: DashboardSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headingBlock}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel}, ${title}`}
            hitSlop={8}
            style={styles.action}
          >
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {isEmpty && emptyText ? <Text style={styles.empty}>{emptyText}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headingBlock: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  subtitle: {
    ...typography.label,
    color: colors.textSecondary,
  },
  action: {
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  actionLabel: {
    ...typography.label,
    color: colors.primary,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
