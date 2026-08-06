import { Pressable, Text, View } from "react-native";
import { dashboardStyles, toneBackground, toneColor } from "./dashboardStyles";
import type { RiskClientData } from "./dashboardTypes";

type Props = {
  client: RiskClientData;
};

export function ClientRiskRow({ client }: Props) {
  return (
    <Pressable
      onPress={client.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${client.name}. ${client.reason}. ${client.metric} logged.`}
      style={({ pressed }) => [dashboardStyles.row, pressed && dashboardStyles.rowPressed]}
    >
      <View style={dashboardStyles.avatar}>
        <Text style={dashboardStyles.avatarText}>{client.name[0]?.toUpperCase() || "?"}</Text>
      </View>
      <View style={dashboardStyles.rowBody}>
        <Text style={dashboardStyles.rowTitle} numberOfLines={1}>
          {client.name}
        </Text>
        {/*
          The reason is the signal — "9 days since last workout". The tinted
          pill beside it is a second, redundant cue, because colour alone fails
          for anyone who cannot separate red from amber.
        */}
        <Text style={dashboardStyles.rowMeta} numberOfLines={1}>
          {client.reason}
        </Text>
      </View>
      <View style={[dashboardStyles.pill, { backgroundColor: toneBackground(client.tone) }]}>
        <Text style={[dashboardStyles.pillText, { color: toneColor(client.tone) }]}>
          {client.metric}
        </Text>
      </View>
    </Pressable>
  );
}
