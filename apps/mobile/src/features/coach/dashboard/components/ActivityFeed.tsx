import { View } from "react-native";
import { DashboardSection } from "./DashboardSection";
import { ActivityItem } from "./ActivityItem";
import { dashboardStyles } from "./dashboardStyles";
import type { ActivityItemData } from "./dashboardTypes";

type Props = {
  items: ActivityItemData[];
};

export function ActivityFeed({ items }: Props) {
  return (
    <DashboardSection
      title="Since yesterday"
      isEmpty={items.length === 0}
      emptyText="Client activity will appear here."
    >
      <View style={dashboardStyles.list}>
        {items.map((item) => (
          <ActivityItem key={item.id} item={item} />
        ))}
      </View>
    </DashboardSection>
  );
}
