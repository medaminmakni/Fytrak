import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Typography } from "../../components/Typography";
import { colors } from "../../theme/colors";
import { useNavigation } from "@react-navigation/native";
import { ScreenShell } from "../../components/ScreenShell";
import { Loader } from "../../components/Loader";
import { ActivityFeed } from "../../features/coach/dashboard/components/ActivityFeed";
import { QuietClients } from "../../features/coach/dashboard/components/QuietClients";
import { AttentionCenter } from "../../features/coach/dashboard/components/AttentionCenter";
import { ClientRosterPreview } from "../../features/coach/dashboard/components/ClientRosterPreview";
import { KpiStrip } from "../../features/coach/dashboard/components/KpiStrip";
import { PriorityCard, type PriorityCardData } from "../../features/coach/dashboard/components/PriorityCard";
import type {
  ActivityItemData,
  AttentionItemData,
  DashboardIcon,
  QuietClientData,
  RosterClientData,
  DashboardTone,
} from "../../features/coach/dashboard/components/dashboardTypes";
import { describeSignalActivity, type ClientActivityState } from "../../features/coaching/coachIntelligence";
import { selectPendingPainReports } from "../../features/coaching/painQueue";
import { buildPainActionId, totalWaitingCount } from "../../features/coach/dashboard/coachActions";
import { formatClientActivity } from "../../features/coach/dashboard/components/ClientActivityLine";
import { useCoachDashboard } from "../../hooks/useCoachDashboard";
import { useUserProfile } from "../../hooks/useUserProfile";
import { logOut } from "../../services/auth";
import { ToastService } from "../../components/Toast";
import type { CoachHomeNavigation } from "../../navigation/types";
import { iconSize, layout, radius, spacing } from "../../theme/tokens";

type CoachActionType = "pain" | "request" | "silent" | "message";

type CoachAction = {
  /**
   * Unique per ITEM, not per kind. This was `type`, so three clients in pain
   * all rendered with the React key "pain" and the list could reuse one
   * client's row for another's data.
   */
  id: string;
  type: CoachActionType;
  /** 0 is pain. Nothing outranks a client saying something hurt. */
  priority: 0 | 1 | 2 | 3;
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
    recentActivity,
    clientSignalById,
    handleReviewRequest,
  } = useCoachDashboard();

  /*
   * Every client's activity state, resolved once.
   *
   * The screen previously resolved this in four places from three different
   * sources — `atRiskClients`, `clientIntelligenceById` and an inline
   * timestamp conversion — so the priority card, the roster and the counts
   * could each describe the same client differently. One map, one answer.
   */
  const activityByClientId = useMemo(() => {
    const map = new Map<string, ClientActivityState>();
    for (const client of assigned) {
      const signal = clientSignalById.get(client.id);
      map.set(
        client.id,
        signal ? describeSignalActivity(signal) : { kind: "never_logged" },
      );
    }
    return map;
  }, [assigned, clientSignalById]);

  /*
   * Clients who have gone quiet, longest first.
   *
   * Derived once because two things read it and they must agree: the priority
   * card names the quietest client, and the section below lists them. Deriving
   * it twice meant two sorts that could tie-break differently, so the card
   * could name someone who was not first in the list under it.
   */
  const silentClients = useMemo(() => {
    return assigned
      .map((client) => ({ client, state: activityByClientId.get(client.id) }))
      .filter(
        (entry): entry is { client: (typeof assigned)[number]; state: { kind: "silent"; daysAgo: number } } =>
          entry.state?.kind === "silent",
      )
      .sort(
        (a, b) =>
          b.state.daysAgo - a.state.daysAgo ||
          // A stable tie-break, so two clients quiet the same number of days do
          // not swap places between renders.
          a.client.id.localeCompare(b.client.id),
      );
  }, [activityByClientId, assigned]);

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

  /** Pure, sorted, and shared by the card and the queue. */
  const pendingPain = useMemo(() => selectPendingPainReports(assigned), [assigned]);

  const coachActions = useMemo<CoachAction[]>(() => {
    const actions: CoachAction[] = [];

    /*
     * Pain outranks everything, including a new client request.
     *
     * Every pending report becomes its own queue item, newest first — the first
     * version took an arbitrary `find`, always counted 1, and hid every other
     * client in pain. `selectPendingPainReports` is pure and sorted, so the
     * raised card and the queue below it come from ONE ordering and cannot
     * disagree about who is most urgent.
     *
     * "Pending" means unacknowledged. A report clears only when the coach marks
     * the matching client-day reviewed, never because they opened a screen.
     *
     * Deliberately NOT a push notification: pain is one of the three things the
     * brief allows to push, but a fake local notification would be worse than
     * none. It is the top of the in-app queue instead.
     */
    pendingPain.forEach((report) => {
      actions.push({
        id: buildPainActionId(report.traineeId, report.dateKey, report.reportedAtMillis),
        type: "pain",
        priority: 0,
        // ONE. Each report speaks for itself. Carrying `pendingPain.length`
        // here made three reports sum to nine on the priority card.
        count: 1,
        tone: "warning",
        icon: "alert-circle-outline",
        headline: `${report.traineeName} reported pain`,
        queueTitle: report.traineeName,
        detail: report.note ? `“${report.note}”` : "Reported after a session",
        actionLabel: "Open client",
        onPress: () => openClient(report.traineeId, report.traineeName),
      });
    });

    if (pending.length > 0) {
      const request = pending[0];
      const name = request.name || "A new client";
      actions.push({
        // Aggregate: one row standing for every waiting request.
        id: "request",
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

    /*
     * Attention is silence, and only silence.
     *
     * This read `atRiskClients`, which comes from `scoreCoachClient` — a
     * composite of workouts, meals LOGGED and a protein guess that pays out for
     * clients with no target. So "falling behind" could fire for someone
     * training four times a week who had stopped photographing lunch, and its
     * `riskReason` was a grade rather than a fact.
     *
     * `describeSignalActivity` resolves calendar days in the CLIENT's zone, so
     * the days quoted here are days the client actually lived through.
     */
    if (silentClients.length > 0) {
      const quietest = silentClients[0];
      const name = quietest.client.name || "A client";
      actions.push({
        id: `silent:${quietest.client.id}`,
        type: "silent",
        priority: 2,
        count: silentClients.length,
        tone: quietest.state.daysAgo >= 7 ? "danger" : "warning",
        icon: "pulse-outline",
        headline: `${name} has gone quiet`,
        queueTitle: name,
        detail: `Nothing logged for ${quietest.state.daysAgo} days`,
        actionLabel: "Open client",
        onPress: () => openClient(quietest.client.id, name),
      });
    }

    if (unreadMessages > 0) {
      actions.push({
        // Aggregate: one row standing for every unread message.
        id: "message",
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
  }, [handleReviewRequest, navigation, pending, pendingPain, silentClients, unreadMessages]);

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
      id: action.id,
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
    const waiting = totalWaitingCount(coachActions);
    return {
      eyebrow: waiting > 1 ? `Highest priority · ${waiting} waiting` : "Highest priority",
      icon: topAction.icon,
      title: topAction.headline,
      detail: topAction.detail,
      actionLabel: topAction.actionLabel,
      onPress: topAction.onPress,
    };
  }, [coachActions, topAction]);

  /*
   * The section under the queue: who has been quiet longest.
   *
   * This mapped `atRiskClients` and printed `client.riskReason` — strings like
   * "Nutrition logging is sparse", produced by thresholding a score. The rows
   * now carry the activity state itself, which is a date the client can be
   * asked about.
   */
  const quietClients = useMemo<QuietClientData[]>(() => {
    return silentClients.slice(0, 5).map(({ client, state }) => {
      const name = client.name || "Anonymous";
      return {
        id: client.id,
        name,
        profileImageUrl: client.profileImageUrl,
        activity: state,
        onPress: () => openClient(client.id, name),
      };
    });
  }, [silentClients]);

  /*
   * "Since yesterday" says when, not how many.
   *
   * This row used to print `${workoutsLast7Days} workouts this week` — a
   * seven-day rolling total under a heading about the last day. The two
   * disagreed on their own face: a client who trained once this morning read
   * "4 workouts this week", which is true and answers a question nobody asked
   * standing in this section.
   *
   * `lastWorkoutAt` is the fact the section is actually about, and the roster
   * snapshot already carries it.
   */
  /*
   * "Since yesterday" means exactly that: a bounded two-day window in each
   * CLIENT's own calendar.
   *
   * `recentActivity` is only sorted by recency — it has no window at all, so a
   * client whose last session was in March appeared under a heading about the
   * last day. Filtering on the activity state keeps the section honest, and
   * because that state is resolved per client, a coach in London and a client
   * in Auckland still agree on which day is "yesterday".
   */
  const activityItems = useMemo<ActivityItemData[]>(() => {
    return recentActivity
      .map((client) => ({ client, state: describeSignalActivity(client) }))
      .filter(
        ({ state }) =>
          state.kind === "logged_today" ||
          (state.kind === "logged_recently" && state.daysAgo === 1),
      )
      .slice(0, 4)
      .map(({ client, state }) => {
        const trainee = assigned.find((item) => item.id === client.traineeId);
        const name = trainee?.name || "Client";
        return {
          id: client.traineeId,
          title: `${name} logged a workout`,
          subtitle: formatClientActivity(state),
        };
      });
  }, [assigned, recentActivity]);

  const rosterClients = useMemo<RosterClientData[]>(() => {
    return assigned.slice(0, 5).map((client) => {
      const name = client.name || "Anonymous";
      return {
        id: client.id,
        name,
        profileImageUrl: client.profileImageUrl,
        goal: client.profile?.goal || "General fitness",
        activity: activityByClientId.get(client.id) ?? { kind: "never_logged" as const },
        onPress: () => openClient(client.id, name),
      };
    });
  }, [activityByClientId, assigned]);

  /*
   * Counts, derived from the same roster snapshot the rows use — no second
   * source, so a tile can never disagree with the list under it.
   */
  const activityCounts = useMemo(() => {
    let loggedToday = 0;
    let silent = 0;
    for (const client of assigned) {
      const state = activityByClientId.get(client.id) ?? ({ kind: "never_logged" } as const);
      if (state.kind === "logged_today") loggedToday += 1;
      // `never_logged` is excluded on purpose: a client who has not started is
      // not a client who has gone quiet, and counting them as silent would send
      // the coach chasing someone who joined yesterday.
      if (state.kind === "silent") silent += 1;
    }
    return { loggedToday, silent };
  }, [activityByClientId, assigned]);

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
          {/*
            A coach with nothing waiting saw NOTHING here: `priorityCard` was
            null and AttentionCenter returns null when its list is empty, so the
            top of the dashboard was simply blank — indistinguishable from a
            screen that had failed to load. An empty queue is a real, good
            answer and it now says so.
          */}
          {priorityCard ? (
            <PriorityCard {...priorityCard} />
          ) : (
            <View style={styles.noActions}>
              <Ionicons name="checkmark-circle-outline" size={iconSize.md} color={colors.textSecondary} />
              <Typography variant="bodyStrong" color={colors.textSecondary}>
                No actions pending
              </Typography>
            </View>
          )}

          <KpiStrip
            totalClients={assigned.length}
            loggedToday={activityCounts.loggedToday}
            silent={activityCounts.silent}
          />

          <AttentionCenter items={attentionItems} />

          {quietClients.length > 0 ? <QuietClients clients={quietClients} /> : null}

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
  noActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
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
