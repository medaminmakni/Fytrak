import { Pressable, StyleSheet, Text, View } from "react-native";
import { DashboardSection } from "./DashboardSection";
import { dashboardStyles } from "./dashboardStyles";
import { colors } from "../../../../theme/colors";
import { typography } from "../../../../theme/tokens";
import type { RosterClientData } from "./dashboardTypes";

type Props = {
  clients: RosterClientData[];
  onSeeAll: () => void;
};

export function ClientRosterPreview({ clients, onSeeAll }: Props) {
  return (
    <DashboardSection
      title="Clients"
      actionLabel="See all"
      onAction={onSeeAll}
      isEmpty={clients.length === 0}
      emptyText="Assigned clients will appear here."
    >
      <View style={dashboardStyles.list}>
        {clients.map((client) => (
          <Pressable
            key={client.id}
            onPress={client.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${client.name}, ${client.goal}, ${client.compliance} logged`}
            style={({ pressed }) => [dashboardStyles.row, pressed && dashboardStyles.rowPressed]}
          >
            <View style={dashboardStyles.avatar}>
              <Text style={dashboardStyles.avatarText}>{client.name[0]?.toUpperCase() || "?"}</Text>
            </View>
            <View style={dashboardStyles.rowBody}>
              <Text style={dashboardStyles.rowTitle} numberOfLines={1}>
                {client.name}
              </Text>
              <Text style={dashboardStyles.rowMeta} numberOfLines={1}>
                {client.goal}
              </Text>
            </View>
            {/*
              Reads as a bare percentage, so it is labelled. It is the logging
              consistency score, not adherence to a plan — see KpiStrip.
            */}
            <Text style={styles.metric}>{client.compliance} logged</Text>
          </Pressable>
        ))}
      </View>
    </DashboardSection>
  );
}

const styles = StyleSheet.create({
  metric: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
