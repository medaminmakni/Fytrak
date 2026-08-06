import { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ScreenShell } from "../../components/ScreenShell";
import { Loader } from "../../components/Loader";
import { ActivityFeed } from "../../features/coach/dashboard/components/ActivityFeed";
import { AtRiskClients } from "../../features/coach/dashboard/components/AtRiskClients";
import { AttentionCenter } from "../../features/coach/dashboard/components/AttentionCenter";
import { ClientRosterPreview } from "../../features/coach/dashboard/components/ClientRosterPreview";
import { KpiStrip } from "../../features/coach/dashboard/components/KpiStrip";
import { PriorityCard, type PriorityCardData } from "../../features/coach/dashboard/components/PriorityCard";
import type {
  ActivityItemData,
  AttentionItemData,
  DashboardIcon,
  RiskClientData,
  RosterClientData,
  DashboardTone,
} from "../../features/coach/dashboard/components/dashboardTypes";
import { useCoachDashboard } from "../../hooks/useCoachDashboard";
import { useUserProfile } from "../../hooks/useUserProfile";
import { logOut } from "../../services/auth";
import { ToastService } from "../../components/Toast";
import type { CoachHomeNavigation } from "../../navigation/types";
import { layout, spacing } from "../../theme/tokens";

type CoachActionType = "request" | "checkin" | "risk" | "message";

type CoachAction = {
  type: CoachActionType;
  priority: 1 | 2 | 3 | 4;
  count: number;
  tone: DashboardTone;
  icon: DashboardIcon;
  /** Reads as a situation on the raised card: "Sara wants to join". */
  headline: string;
  /** Reads as a task in the queue: "Review new client request". */
  queueTitle: string;
  detail?: string;
  actionLabel: string;
  onPress: () => void;
};

export function CoachHomeScreen() {
  const navigation = useNavigation<CoachHomeNavigation>();
  const { profile } = useUserProfile();
  const {
    pending,
    assigned,
    isLoading,
    stats,
    unreadMessages,
    checkInsDue,
    atRiskClients,
    recentActivity,
    clientIntelligenceById,
    handleReviewRequest,
  } = useCoachDashboard();

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const handleLogout = () => {
    ToastService.confirm({
      title: "Sign out?",
      message: "You can sign back in at any time.",
      confirmLabel: "Sign out",
      destructive: true,
      onConfirm: async () => {
        try {
          await logOut();
        } catch (error) {
          console.error("[CoachHome] Sign out failed:", error);
          ToastService.error("Sign out failed", "Please try again.");
        }
      },
    });
  };

  const openClient = (traineeId: string, traineeName?: string) => {
    const trainee = assigned.find((candidate) => candidate.id === traineeId);
    navigation.navigate("TraineeDetail", {
      traineeId,
      traineeName: traineeName || "Anonymous",
      traineeTimezone: trainee?.timezone ?? null,
    });
  };

  const coachActions = useMemo<CoachAction[]>(() => {
    const actions: CoachAction[] = [];

    if (pending.length > 0) {
      const request = pending[0];
      const name = request.name || "A new client";
      actions.push({
        type: "request",
        priority: 1,
        count: pending.length,
        tone: "info",
        icon: "person-add-outline",
        headline: `${name} wants to join`,
        queueTitle:
          pending.length === 1
            ? "New client request"
            : `${pending.length} client requests`,
        // The pending snapshot carries the trainee's goal but no timestamp, so
        // this says what it knows rather than guessing at "requested 2 days ago".
        detail: request.profile?.goalText || request.profile?.goal || undefined,
        actionLabel: "Review request",
        onPress: () => handleReviewRequest(request.id, request.name || "Anonymous"),
      });
    }

    if (atRiskClients.length > 0) {
      const highRisk = atRiskClients.find((client) => client.risk === "high") || atRiskClients[0];
      const trainee = assigned.find((item) => item.id === highRisk.traineeId);
      const name = trainee?.name || "A client";
      actions.push({
        type: "risk",
        priority: 2,
        count: atRiskClients.length,
        tone: highRisk.risk === "high" ? "danger" : "warning",
        icon: "pulse-outline",
        headline: `${name} is falling behind`,
        queueTitle: name,
        detail: highRisk.riskReason,
        actionLabel: "Open client",
        onPress: () => openClient(highRisk.traineeId, name),
      });
    }

    if (unreadMessages > 0) {
      actions.push({
        type: "message",
        priority: 3,
        count: unreadMessages,
        tone: "info",
        icon: "chatbubble-ellipses-outline",
        headline: `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`,
        queueTitle: `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`,
        detail: "Clients are waiting on a reply",
        actionLabel: "Open inbox",
        onPress: () => navigation.navigate("CoachInbox"),
      });
    }

    return actions.sort((first, second) => first.priority - second.priority);
  }, [assigned, atRiskClients, handleReviewRequest, navigation, pending, unreadMessages]);

  /*
   * The queue drives both the raised card and the list below it, but the top
   * item appears in ONE of them, never both. The previous version fed the same
   * array to AttentionCenter AND TodayTasks, so a coach with a single pending
   * request read "Review new client request" twice on one screen.
   *
   * The "checkin" action is gone for the same reason: it was derived from
   * `checkInsDue`, which is `atRiskClients.filter(risk === "high").length` — the
   * same clients the risk action already surfaces, worded differently.
   */
  const [topAction, ...queuedActions] = coachActions;

  const attentionItems = useMemo<AttentionItemData[]>(() => {
    return queuedActions.slice(0, 4).map((action) => ({
      id: action.type,
      tone: action.tone,
      badge: action.actionLabel,
      title: action.queueTitle,
      clientName: action.detail,
      actionLabel: action.actionLabel,
      onPress: action.onPress,
    }));
  }, [queuedActions]);

  const priorityCard = useMemo<PriorityCardData | null>(() => {
    if (!topAction) return null;
    const waiting = coachActions.reduce((sum, action) => sum + action.count, 0);
    return {
      eyebrow: waiting > 1 ? `Highest priority · ${waiting} waiting` : "Highest priority",
      icon: topAction.icon,
      title: topAction.headline,
      detail: topAction.detail,
      actionLabel: topAction.actionLabel,
      onPress: topAction.onPress,
    };
  }, [coachActions, topAction]);

  const riskClients = useMemo<RiskClientData[]>(() => {
    return atRiskClients.slice(0, 5).map((client) => {
      const trainee = assigned.find((item) => item.id === client.traineeId);
      const name = trainee?.name || "Anonymous";
      return {
        id: client.traineeId,
        name,
        reason: client.riskReason,
        metric: `${client.complianceScore}%`,
        tone: client.risk === "high" ? "danger" : "warning",
        onPress: () => openClient(client.traineeId, name),
      };
    });
  }, [assigned, atRiskClients]);

  const activityItems = useMemo<ActivityItemData[]>(() => {
    return recentActivity.slice(0, 4).map((client) => {
      const trainee = assigned.find((item) => item.id === client.traineeId);
      const name = trainee?.name || "Client";
      return {
        id: client.traineeId,
        title: `${name} completed a workout`,
        subtitle: `${client.workoutsLast7Days} workout${client.workoutsLast7Days === 1 ? "" : "s"} this week`,
      };
    });
  }, [assigned, recentActivity]);

  const rosterClients = useMemo<RosterClientData[]>(() => {
    return assigned.slice(0, 5).map((client) => {
      const intelligence = clientIntelligenceById.get(client.id);
      const name = client.name || "Anonymous";
      return {
        id: client.id,
        name,
        goal: client.profile?.goal || "General Fitness",
        compliance: intelligence ? `${intelligence.complianceScore}%` : "--%",
        onPress: () => openClient(client.id, name),
      };
    });
  }, [assigned, clientIntelligenceById]);

  return (
    <ScreenShell
      // "Today" rather than a greeting: it matches the tab label the coach just
      // tapped, and it does not go stale — a time-of-day greeting is wrong the
      // moment the screen sits open across noon. The date carries the context.
      title="Today"
      subtitle={todayLabel}
      contentStyle={styles.shellContent}
      rightActionIcon={!profile?.profileImageUrl ? "person-circle-outline" : undefined}
      rightActionImageUri={profile?.profileImageUrl}
      rightActionMenu={[
        { label: "Profile", icon: "person-outline", onPress: () => navigation.navigate("CoachProfile") },
        { label: "Sign out", icon: "log-out-outline", onPress: handleLogout, destructive: true },
      ]}
    >
      {isLoading ? (
        <Loader label="Loading your dashboard" />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {priorityCard ? <PriorityCard {...priorityCard} /> : null}

          <KpiStrip
            totalClients={stats.totalClients}
            activeClients={assigned.length}
            consistency={stats.consistency}
            followUpsDue={checkInsDue}
          />

          <AttentionCenter items={attentionItems} />

          {riskClients.length > 0 ? <AtRiskClients clients={riskClients} /> : null}

          {rosterClients.length > 0 ? (
            <ClientRosterPreview
              clients={rosterClients}
              onSeeAll={() => navigation.navigate("CoachClients")}
            />
          ) : null}

          {activityItems.length > 0 ? <ActivityFeed items={activityItems} /> : null}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shellContent: {
    paddingBottom: 0,
  },
  scroll: {
    // Clears the floating tab bar.
    paddingBottom: 140,
    gap: layout.sectionGap,
    marginTop: spacing.sm,
  },
});
