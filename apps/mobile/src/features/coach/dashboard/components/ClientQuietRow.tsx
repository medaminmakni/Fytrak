import { Image, Pressable, Text, View } from "react-native";
import { dashboardStyles } from "./dashboardStyles";
import { ClientActivityLine } from "./ClientActivityLine";
import { formatClientActivity } from "./ClientActivityLine";
import type { QuietClientData } from "./dashboardTypes";

type Props = {
  client: QuietClientData;
};

export function ClientQuietRow({ client }: Props) {
  return (
    <Pressable
      onPress={client.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${client.name}. ${formatClientActivity(client.activity)}.`}
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
        {/*
          The tinted pill holding a percentage is gone. It showed
          `complianceScore`, which counts meals logged rather than comparing
          them to anything — so it could read 92% for a client eating double
          their target. The row now states two facts and grades neither: how
          long they have been quiet — and nothing else.
        */}
        <ClientActivityLine state={client.activity} />
      </View>
    </Pressable>
  );
}
