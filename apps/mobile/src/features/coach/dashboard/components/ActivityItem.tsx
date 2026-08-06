import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../../../theme/colors";
import { spacing } from "../../../../theme/tokens";
import { dashboardStyles } from "./dashboardStyles";
import type { ActivityItemData } from "./dashboardTypes";

type Props = {
  item: ActivityItemData;
};

export function ActivityItem({ item }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.dot} />
      <View style={dashboardStyles.rowBody}>
        <Text style={dashboardStyles.rowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={dashboardStyles.rowMeta} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Not the shared `row`: this one is not tappable, so it does not claim a
  // 56px target it cannot honour.
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
    backgroundColor: colors.success,
  },
});
