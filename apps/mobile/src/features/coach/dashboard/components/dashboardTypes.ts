import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { ClientActivityState } from "../../../coaching/coachIntelligence";

export type DashboardTone = "danger" | "warning" | "info" | "success" | "neutral";
export type DashboardIcon = ComponentProps<typeof Ionicons>["name"];

export type AttentionItemData = {
  id: string;
  tone: DashboardTone;
  badge: string;
  title: string;
  clientName?: string;
  actionLabel: string;
  onPress: () => void;
};

export type TaskItemData = {
  id: string;
  title: string;
  subtitle: string;
  tone: DashboardTone;
  onPress: () => void;
};

/**
 * A client who has gone quiet.
 *
 * `reason: string` was removed with the risk engine. It carried `riskReason` —
 * "Nutrition logging is sparse", "Protein is below target" — strings produced
 * by thresholding `complianceScore`, printed under the activity line as though
 * they were a second, independent observation. They were the same score said
 * twice. `activity` is the whole row now.
 */
export type QuietClientData = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  /** How long they have been quiet. Replaces the `metric` percentage. */
  activity: ClientActivityState;
  onPress: () => void;
};

export type ActivityItemData = {
  id: string;
  title: string;
  subtitle: string;
};

export type RosterClientData = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  goal: string;
  /** Was `compliance: "78%"`. See ClientActivityLine for why that number went. */
  activity: ClientActivityState;
  onPress: () => void;
};

export type NotificationItemData = {
  id: string;
  title: string;
  tone: DashboardTone;
};
