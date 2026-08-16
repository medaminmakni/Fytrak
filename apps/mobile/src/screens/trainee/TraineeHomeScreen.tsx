import { ToastService } from "../../components/Toast";
import { useMemo } from "react";
import { Pressable, StyleSheet, View, ActivityIndicator, ScrollView } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { TraineeHomeNavigation } from "../../navigation/types";
import { Typography } from "../../components/Typography";
import { useTraineeDashboard } from "../../hooks/useTraineeDashboard";
import { deriveTodayState } from "../../features/today/todayState";
import { TodaySessionCard } from "../../features/today/components/TodaySessionCard";
import { TodayTargets } from "../../features/today/components/TodayTargets";
import { TodayQuickActions } from "../../features/today/components/TodayQuickActions";
import { Surface } from "../../components/Surface";
import { updateCheckInTaskStatus } from "../../services/userSession";
import { logOut } from "../../services/auth";
import { toSafeDate } from "../../utils/chartFilters";
import { auth } from "../../config/firebase";
import type { ProgramSession } from "../../services/programService";
import { ErrorState } from "../../components/ErrorState";

type TraineeHomeScreenProps = {
  onQuickAskCoach: () => void;
};

export function TraineeHomeScreen({ onQuickAskCoach }: TraineeHomeScreenProps) {
  const navigation = useNavigation<TraineeHomeNavigation>();

  const {
    profile,
    workouts,
    todayWorkoutPlan,
    todayPlanRevisions,
    planStatus,
    hasProgramCoveringToday,
    isTodayProgramSessionCompleted,
    dateKey,
    meals,
    checkInTasks,
    isLoading,
    profileError,
    retryProfile,
    isPremium,
    nutritionStats,
    greeting,
  } = useTraineeDashboard();
  const hasAssignedCoach = profile?.assignmentStatus === "assigned" && !!profile?.selectedCoachId;

  const formatDueDate = (value?: string | null) => {
    if (!value) return "";
    const date = toSafeDate(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleTaskAction = async (taskId: string, status: "completed" | "dismissed") => {
    const traineeId = auth.currentUser?.uid || profile?.uid;
    if (!traineeId) {
      ToastService.error("Session expired", "Please sign in again.");
      return;
    }

    try {
      await updateCheckInTaskStatus(traineeId, taskId, status);
      ToastService.success(
        status === "completed" ? "Task completed" : "Task dismissed",
        status === "completed" ? "Nice work staying accountable." : "No worries. Keep moving forward."
      );
    } catch (error) {
      console.error("Failed to update task:", error);
      ToastService.error("Update failed", "Could not update the check-in task.");
    }
  };

  /*
   * What today IS, as one value. Derived by the pure module rather than
   * inferred from which of nine cards happened to have content.
   */
  const todayState = useMemo(
    () => deriveTodayState({
      planStatus,
      loggedSessionCount: workouts.length,
      plannedWorkout: todayWorkoutPlan.sourceType === "none" ? null : {
        /*
         * For a PROGRAM session, completion comes from source-matched logs —
         * the program document is the coach's and the trainee cannot write to
         * it, so `isCompleted` inside it can never be the truth. For a daily
         * prescription the document's own flag is authoritative.
         */
        isCompleted: todayWorkoutPlan.sourceType === "program"
          ? isTodayProgramSessionCompleted
          : (todayWorkoutPlan.payload as { isCompleted?: boolean })?.isCompleted === true,
        title: (todayWorkoutPlan.payload as { title?: string })?.title || "Planned session",
        exerciseCount: Array.isArray((todayWorkoutPlan.payload as { exercises?: unknown[] })?.exercises)
          ? ((todayWorkoutPlan.payload as { exercises: unknown[] }).exercises).length
          : null,
        sourceType: todayWorkoutPlan.sourceType,
      },
      hasProgramCoveringToday,
    }),
    [planStatus, workouts.length, todayWorkoutPlan, hasProgramCoveringToday, isTodayProgramSessionCompleted]
  );

  /** The client's own day, spelled out. Their calendar, not the device's. */
  const todayLabel = useMemo(() => {
    const parsed = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  }, [dateKey]);

  /** Protein logged today. Same reduce the nutrition screen uses. */
  const proteinLogged = useMemo(
    () => meals.reduce((sum, meal) => sum + (meal.protein || 0), 0),
    [meals]
  );

  const quickActions = useMemo(() => [
    { key: "meal", label: "Log a meal", icon: "restaurant-outline" as const, onPress: () => navigation.navigate("Nutrition") },
    { key: "weigh", label: "Weigh in", icon: "scale-outline" as const, onPress: () => navigation.navigate("Progress") },
    { key: "photo", label: "Photo", icon: "camera-outline" as const, onPress: () => navigation.navigate("Progress") },
  ], [navigation]);

  const handleTodaySessionAction = () => {
    if (todayWorkoutPlan.sourceType === "daily") {
      navigation.navigate("Workouts", { autoLoadPrescriptionId: todayWorkoutPlan.sourceId });
      return;
    }
    if (todayWorkoutPlan.sourceType === "program") {
      navigation.navigate("Workouts", {
          programSession: todayWorkoutPlan.payload as ProgramSession,
          // Carried so the saved log can prove which session it satisfied.
          programId: todayWorkoutPlan.sourceId,
          programScheduledDateKey: todayWorkoutPlan.dateKey,
        });
      return;
    }
    navigation.navigate("Workouts");
  };

  const handleLogout = () => {
    ToastService.confirm({
      title: "Sign out",
      message: "Are you sure you want to leave Fytrak?",
      confirmLabel: "Sign out",
      destructive: true,
      onConfirm: async () => {
        try {
          await logOut();
          ToastService.info("Signed out", "Your Fytrak session has been closed.");
        } catch (error) {
          ToastService.error("Sign out failed", "Please try again.");
        }
      },
    });
  };

  return (
    <ScreenShell
      title="FYTRAK"
      contentStyle={styles.shellContent}
      rightActionIcon={!profile?.profileImageUrl ? "person-circle-outline" : undefined}
      rightActionImageUri={profile?.profileImageUrl}
      rightActionMenu={[
        { label: "Profile", icon: "person-outline", onPress: () => navigation.navigate("Profile") },
        { label: "Sign out", icon: "log-out-outline", onPress: handleLogout, destructive: true },
      ]}
    >
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : profileError ? (
        <ErrorState
          title="We couldn't load your dashboard"
          message="Check your connection and try again."
          onRetry={retryProfile}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          <View style={styles.container}>

            {/* COACH ASSIGNMENT BANNER */}
            {!hasAssignedCoach && (
              <Pressable 
                style={styles.premiumBanner}
                onPress={() => {
                  if (profile?.assignmentStatus === 'pending') {
                    navigation.navigate("PendingCoach");
                  } else {
                    navigation.navigate("CoachAssignment");
                  }
                }}
              >
                <View style={styles.bannerInfo}>
                  <Ionicons 
                      name={profile?.assignmentStatus === 'pending' ? "hourglass-outline" : profile?.assignmentStatus === 'rejected' ? "refresh-circle-outline" : "sparkles"}
                      size={24} 
                      color={colors.primary} 
                  />
                  <View>
                    <Typography variant="h2" style={{ fontSize: 16 }}>
                      {profile?.assignmentStatus === 'pending' ? "Coach Request Pending" : profile?.assignmentStatus === 'rejected' ? "Coach Request Declined" : "Find Your Coach"}
                    </Typography>
                    <Typography variant="label" color={colors.textMuted}>
                      {profile?.assignmentStatus === 'pending' ? `Waiting for ${profile?.selectedCoachName}` : profile?.assignmentStatus === 'rejected' ? "Choose another coach when you're ready" : "Unlock custom plans from elite coaches"}
                    </Typography>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </Pressable>
            )}

            {/*
              DATE, then name. The old header put the greeting in the accent at
              800 weight and the name at 32px below it — two competing titles
              18px apart, with the brightest element on the page spent on
              "GOOD MORNING". The date carries the context; the name is the
              title; neither is yellow, because the accent belongs to the one
              action below.
            */}
            <View style={styles.todayHeader}>
              <View style={styles.grow}>
                <Typography variant="label" color={colors.textSecondary}>{todayLabel}</Typography>
                <Typography variant="h1" style={styles.todayName}>
                  {greeting}, {profile?.name?.split(" ")[0] || "Athlete"}
                </Typography>
              </View>
              {isPremium && <PremiumBadge />}
            </View>

            {/* THE one accent surface on this screen. */}
            <TodaySessionCard
              state={todayState}
              coachName={profile?.selectedCoachName ?? null}
              onStart={handleTodaySessionAction}
              onRetry={retryProfile}
            />

            {/* Profile targets have no persisted author provenance. */}
            <TodayTargets
              targets={[
                { label: "Calories", current: nutritionStats.current, target: nutritionStats.target, unit: " kcal" },
                { label: "Protein", current: proteinLogged, target: profile?.macroTargets?.protein ?? null, unit: "g" },
              ]}
            />

            <TodayQuickActions actions={quickActions} />

            {hasAssignedCoach && checkInTasks.length > 0 && (
              <Surface tone="muted" style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="clipboard" size={18} color={colors.primary} />
                  <Typography variant="h2">Coach check-ins</Typography>
                  <View style={styles.taskCountPill}>
                    <Typography style={styles.taskCountText}>{checkInTasks.length} OPEN</Typography>
                  </View>
                </View>
                <View style={styles.taskList}>
                  {checkInTasks.slice(0, 3).map((task) => {
                    const dueLabel = formatDueDate(task.dueDate);
                    return (
                      <View key={task.id} style={styles.taskItem}>
                        <View style={styles.taskInfo}>
                          <Typography variant="h2" style={styles.taskTitle}>{task.title}</Typography>
                          {!!task.description && (
                            <Typography variant="label" color={colors.textFaint} style={styles.taskDesc}>{task.description}</Typography>
                          )}
                          {!!dueLabel && (
                            <Typography variant="label" color={colors.warning} style={styles.taskDue}>Due {dueLabel}</Typography>
                          )}
                        </View>
                        <View style={styles.taskActions}>
                          <Pressable
                            style={[styles.taskActionBtn, styles.taskActionComplete]}
                            onPress={() => handleTaskAction(task.id, "completed")}
                          >
                            <Ionicons name="checkmark" size={16} color={colors.primaryText} />
                          </Pressable>
                          <Pressable
                            style={[styles.taskActionBtn, styles.taskActionDismiss]}
                            onPress={() => handleTaskAction(task.id, "dismissed")}
                          >
                            <Ionicons name="close" size={16} color={colors.textSecondary} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
                {checkInTasks.length > 3 && (
                  <Typography variant="label" color={colors.textFaint} style={styles.moreTasksText}>
                    {checkInTasks.length - 3} more tasks waiting
                  </Typography>
                )}
              </Surface>
            )}



            {/*
              WHY TODAY'S PLAN CHANGED.
              A coach can genuinely replace a single day's plan, and until now
              the reason they typed was written to `planRevisions` and read only
              on the coach's own screen. The client saw a different plan with no
              explanation — the exact complaint that collection exists to
              answer. One line, stating the coach's own words.
            */}
            {todayPlanRevisions.length > 0 && (
              <Surface tone="muted" style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="git-compare-outline" size={18} color={colors.primary} />
                  <Typography variant="h2">Your coach changed today's plan</Typography>
                </View>
                {todayPlanRevisions.map((revision) => (
                  <View key={revision.id} style={{ gap: 4 }}>
                    {revision.summary ? (
                      <Typography variant="body">{revision.summary}</Typography>
                    ) : null}
                    <Typography variant="label" color={colors.textSecondary}>
                      {revision.reason}
                    </Typography>
                  </View>
                ))}
              </Surface>
            )}

          </View>
        </ScrollView>
      )}

    </ScreenShell>
  );
}


function PremiumBadge() {
  return (
    <View style={styles.premiumBadge}>
      <Ionicons name="star" size={10} color="#000" />
      <Typography style={{ fontSize: 11, color: '#000', fontWeight: '900' }}>PREMIUM</Typography>
    </View>
  );
}


const styles = StyleSheet.create({
  shellContent: { paddingBottom: 0 },
  scrollContainer: { paddingBottom: 140 },
  loader: { paddingTop: 40, alignItems: "center" },
  container: {
    gap: spacing.lg,
    marginTop: 10,
  },
  todayHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  grow: { flex: 1 },
  todayName: { marginTop: 2 },
  premiumBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bgElevated,
    padding: spacing.xl,
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  bannerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  // Geometry and surface now come from <Surface tone="muted">; this keeps only
  // the internal layout. The per-card colour overrides at the call sites are
  // left untouched here — recolouring those is P1-3, not P1-1.
  card: { gap: spacing.lg },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  

  taskCountPill: { marginStart: "auto", backgroundColor: colors.primaryMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  taskCountText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  taskList: { gap: spacing.md },
  taskItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.bgDark, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle },
  taskInfo: { flex: 1, gap: 4 },
  taskTitle: { fontSize: 14 },
  taskDesc: { fontSize: 11 },
  taskDue: { fontSize: 11 },
  taskActions: { flexDirection: "row", gap: 8 },
  taskActionBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  taskActionComplete: { backgroundColor: colors.primary, borderColor: colors.primary },
  taskActionDismiss: { backgroundColor: "transparent", borderColor: colors.borderStrong },
  moreTasksText: { alignSelf: "flex-end", fontSize: 11 },

  premiumBadge: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, gap: 4, marginStart: 8 },
});
