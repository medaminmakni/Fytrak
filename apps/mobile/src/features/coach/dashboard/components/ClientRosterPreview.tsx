import { Image, Pressable, Text, View } from "react-native";
import { DashboardSection } from "./DashboardSection";
import { dashboardStyles } from "./dashboardStyles";
import { ClientActivityLine, formatClientActivity } from "./ClientActivityLine";
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
            accessibilityLabel={`${client.name}, ${client.goal}, ${formatClientActivity(client.activity)}`}
            style={({ pressed }) => [dashboardStyles.row, pressed && dashboardStyles.rowPressed]}
          >
            <View style={dashboardStyles.avatar}>
              {client.profileImageUrl ? (
                <Image source={{ uri: client.profileImageUrl }} style={dashboardStyles.avatarImage} />
              ) : (
                <Text style={dashboardStyles.avatarText}>{client.name[0]?.toUpperCase() || "?"}</Text>
              )}
            </View>
            <View style={dashboardStyles.rowBody}>
              <Text style={dashboardStyles.rowTitle} numberOfLines={1}>
                {client.name}
              </Text>
              <Text style={dashboardStyles.rowMeta} numberOfLines={1}>
                {client.goal}
              </Text>
            </View>
            {/* Was a trailing "78% logged". See ClientActivityLine. */}
            <ClientActivityLine state={client.activity} />
          </Pressable>
        ))}
      </View>
    </DashboardSection>
  );
}
