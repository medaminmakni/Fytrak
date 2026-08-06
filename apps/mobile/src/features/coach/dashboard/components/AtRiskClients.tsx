import { View } from "react-native";
import { DashboardSection } from "./DashboardSection";
import { ClientRiskRow } from "./ClientRiskRow";
import { dashboardStyles } from "./dashboardStyles";
import type { RiskClientData } from "./dashboardTypes";

type Props = {
  clients: RiskClientData[];
};

export function AtRiskClients({ clients }: Props) {
  return (
    <DashboardSection
      title="At risk"
      isEmpty={clients.length === 0}
      emptyText="No clients are at risk this week."
    >
      <View style={dashboardStyles.list}>
        {clients.map((client) => (
          <ClientRiskRow key={client.id} client={client} />
        ))}
      </View>
    </DashboardSection>
  );
}
