import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

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

export type RiskClientData = {
  id: string;
  name: string;
  reason: string;
  metric: string;
  tone: DashboardTone;
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
  goal: string;
  compliance: string;
  onPress: () => void;
};

export type NotificationItemData = {
  id: string;
  title: string;
  tone: DashboardTone;
};
