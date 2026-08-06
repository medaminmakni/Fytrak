import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../../theme/colors";
import { iconSize } from "../../../../theme/tokens";
import { DashboardSection } from "./DashboardSection";
import { dashboardStyles } from "./dashboardStyles";
import type { AttentionItemData, DashboardTone } from "./dashboardTypes";

const DOT_COLOR: Record<DashboardTone, string> = {
  danger: colors.danger,
  warning: colors.warning,
  info: colors.info,
  success: colors.success,
  neutral: colors.textTertiary,
};

type Props = {
  items: AttentionItemData[];
};

/**
 * Everything still waiting after the one in the priority card.
 *
 * This used to render as cards, and `TodayTasks` rendered the SAME queue again
 * a few hundred pixels below — so a coach with one pending request read "Review
 * new client request" twice on one screen. One list, rows not cards: this is a
 * dense list, and a rounded card per row is a lot of chrome for two lines of
 * text.
 *
 * The dot is a redundant cue, not the signal. Severity is already in the words
 * ("9 days since last workout"), because colour alone fails for anyone who
 * cannot distinguish red from amber.
 */
export function AttentionCenter({ items }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <DashboardSection title="Needs attention">
      <View style={dashboardStyles.list}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.clientName ?? ""}`}
            accessibilityHint={item.actionLabel}
            style={({ pressed }) => [dashboardStyles.row, pressed && dashboardStyles.rowPressed]}
          >
            <View style={[styles.dot, { backgroundColor: DOT_COLOR[item.tone] }]} />
            <View style={dashboardStyles.rowBody}>
              <Text style={dashboardStyles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.clientName ? (
                <Text style={dashboardStyles.rowMeta} numberOfLines={1}>
                  {item.clientName}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={iconSize.md} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </DashboardSection>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
