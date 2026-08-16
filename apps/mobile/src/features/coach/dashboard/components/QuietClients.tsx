import { View } from "react-native";
import { DashboardSection } from "./DashboardSection";
import { ClientQuietRow } from "./ClientQuietRow";
import { dashboardStyles } from "./dashboardStyles";
import type { QuietClientData } from "./dashboardTypes";

type Props = {
  clients: QuietClientData[];
};

/**
 * Renamed from `AtRiskClients`. "At risk" was a verdict the app could not
 * support: it came from `scoreCoachClient`, which grades meals *logged* and
 * pays out free protein points to clients with no target. "Gone quiet" is the
 * fact underneath it — a date, in the client's own calendar.
 */
export function QuietClients({ clients }: Props) {
  return (
    <DashboardSection
      title="Gone quiet"
      isEmpty={clients.length === 0}
      emptyText="Everyone has logged in the last few days."
    >
      <View style={dashboardStyles.list}>
        {clients.map((client) => (
          <ClientQuietRow key={client.id} client={client} />
        ))}
      </View>
    </DashboardSection>
  );
}
