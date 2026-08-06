import { ToastService } from "../../components/Toast";
import { useEffect, useMemo, useState } from "react";
import { I18nManager, Pressable, StyleSheet, View, ActivityIndicator, ScrollView, Text } from "react-native";
import { ScreenShell } from "../../components/ScreenShell";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { TraineeHomeNavigation } from "../../navigation/types";
import { Typography } from "../../components/Typography";
import { MacroRing } from "../../components/MacroRing";
import { ExerciseDetailSheet } from "../../components/ExerciseDetailSheet";
import { EXERCISE_LIBRARY, ExerciseLibraryItem } from "../../constants/exercises";
import { trackEvent } from "../../services/analytics";
import { useTraineeDashboard } from "../../hooks/useTraineeDashboard";
import { DashboardActionCard } from "../../components/DashboardActionCard";
import { Surface } from "../../components/Surface";
import { TodayMissionCard } from "../../features/retention/components/TodayMissionCard";
import type { TodayMissionItemId } from "../../features/retention/todayMission";
import { updateCheckInTaskStatus } from "../../services/userSession";
import { logOut } from "../../services/auth";
import { toSafeDate } from "../../utils/chartFilters";
import { auth } from "../../config/firebase";
import type { ProgramSession } from "../../services/programService";

type TraineeHomeScreenProps = {
  onQuickAskCoach: () => void;
};

export function TraineeHomeScreen({ onQuickAskCoach }: TraineeHomeScreenProps) {
  const navigation = useNavigation<TraineeHomeNavigation>();
  const [selectedEx, setSelectedEx] = useState<ExerciseLibraryItem | null>(null);

  const {
    profile,
    workouts,
    metrics,
    programs,
    todayWorkoutPlan,
    todayNutritionPlan,
    unscheduledWorkouts,
    unscheduledMeals,
    checkInTasks,
    isLoading,
    isPremium,
    nutritionStats,
    workoutStatus,
    greeting,
    todayMission,
    primaryAction,
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

  const handlePrimaryAction = () => {
    const { actionType, payload } = primaryAction;
    switch (actionType) {
      case "workout_prescription":
        navigation.navigate("Workouts", { autoLoadPrescriptionId: payload.prescriptionId });
        break;
      case "workout":
        navigation.navigate(
          "Workouts",
          payload?.programSession ? { programSession: payload.programSession } : undefined
        );
        break;
      case "nutrition":
        navigation.navigate("Nutrition");
        break;
      case "chat":
        onQuickAskCoach();
        break;
      case "progress":
        navigation.navigate("Progress");
        break;
    }
  };

  const handleMissionAction = (missionId: TodayMissionItemId) => {
    trackEvent("today_mission_action_pressed", {
      missionId,
      completionPercent: todayMission.completionPercent,
    });

    if (missionId === "workout") {
      const dailyPrescription = todayWorkoutPlan.sourceType === "daily"
        && todayWorkoutPlan.payload.isCompleted !== true
        ? todayWorkoutPlan.payload
        : null;
      const actionablePrescription = dailyPrescription ?? unscheduledWorkouts[0];
      if (actionablePrescription) {
        navigation.navigate("Workouts", { autoLoadPrescriptionId: actionablePrescription.id });
      } else if (todayWorkoutPlan.sourceType === "program") {
        navigation.navigate("Workouts", { programSession: todayWorkoutPlan.payload as ProgramSession });
      } else {
        navigation.navigate("Workouts");
      }
    } else if (missionId === "nutrition") {
      navigation.navigate("Nutrition");
    } else if (missionId === "coach") {
      if (profile?.assignmentStatus === "assigned") onQuickAskCoach();
      else navigation.navigate("CoachAssignment");
    } else {
      navigation.navigate("Progress");
    }
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

            {/* GREETING HEADER */}
            <View style={styles.greetingHeader}>
              <View>
                <Typography variant="label" color={colors.primary} style={{ fontWeight: '800', letterSpacing: 1 }}>{greeting.toUpperCase()}</Typography>
                <Typography variant="h1" style={{ fontSize: 32, marginTop: 4 }}>{profile?.name?.split(' ')[0] || "Athlete"}</Typography>
              </View>
              {isPremium && <PremiumBadge />}
            </View>

            {/* PRIMARY CONTEXTUAL ACTION */}
            <DashboardActionCard action={primaryAction} onPress={handlePrimaryAction} />

            {/* TODAY STATS SUMMARY */}
            <Surface tone="muted" style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="stats-chart" size={18} color={colors.primary} />
                <Typography variant="h2">Today Status</Typography>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.ringContainer}>
                  <MacroRing 
                    current={nutritionStats.current} 
                    target={nutritionStats.target} 
                    label="Nutrition Intake" 
                  />
                  <View style={styles.ringSideStats}>
                    <View style={styles.sideStatBox}>
                       <Ionicons name="body-outline" size={16} color={colors.textFaint} />
                       <View>
                         <Typography variant="label" color={colors.textFaint} style={{ fontSize: 11 }}>BODY WEIGHT</Typography>
                         <Typography variant="h2" style={{ fontSize: 16 }}>{metrics[0]?.weight || profile?.weight || "--"} <Typography style={{ fontSize: 11, color: colors.textDim }}>kg</Typography></Typography>
                       </View>
                    </View>
                    <View style={styles.sideStatBox}>
                       <Ionicons name={workouts.length > 0 ? "checkmark-circle" : "time-outline"} size={16} color={workouts.length > 0 ? colors.success : colors.textFaint} />
                       <View>
                         <Typography variant="label" color={colors.textFaint} style={{ fontSize: 11 }}>WORKOUT</Typography>
                         <Typography variant="h2" style={{ fontSize: 16, color: workouts.length > 0 ? colors.success : colors.text }}>{workoutStatus}</Typography>
                       </View>
                    </View>
                  </View>
                </View>
              </View>
            </Surface>

            {/* TODAY MISSION TRACKER */}
            <TodayMissionCard mission={todayMission} onAction={handleMissionAction} />

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



            {/* ACTIVE PROGRAM & COACH PLANS */}
            <CoachPlansSection 
                isPremium={isPremium || hasAssignedCoach}
                programs={programs}
                todayWorkoutPlan={todayWorkoutPlan}
                todayNutritionPlan={todayNutritionPlan}
                unscheduledWorkouts={unscheduledWorkouts}
                unscheduledMeals={unscheduledMeals}
                hasWorkoutToday={workouts.length > 0}
                navigation={navigation}
                onSelectExercise={setSelectedEx}
            />

            {/* UTILITY ACTIONS */}
            <Surface tone="muted" style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="compass" size={18} color={colors.primary} />
                <Typography variant="h2">Support tools</Typography>
              </View>
              <View style={styles.actionsGrid}>
                <Pressable
                  style={[styles.actionButton, styles.outlinedAction]}
                  onPress={() => navigation.navigate("Nutrition")}
                >
                  <Ionicons name="nutrition" size={20} color={colors.primary} />
                  <Typography style={[styles.actionButtonText, { color: colors.primary }] as any}>Nutrition</Typography>
                </Pressable>
                {hasAssignedCoach ? (
                  <Pressable 
                    style={styles.actionButton}
                    onPress={onQuickAskCoach}
                  >
                    <Ionicons name="chatbubble-ellipses" size={20} color={colors.primaryText} />
                    <Typography style={styles.actionButtonText}>Ask Coach</Typography>
                  </Pressable>
                ) : (
                  <Pressable 
                    style={[styles.actionButton, { backgroundColor: colors.primary }]} 
                    onPress={() => navigation.navigate("CoachAssignment")}
                  >
                    <Ionicons name="search" size={20} color={colors.primaryText} />
                    <Typography style={styles.actionButtonText}>Find Coach</Typography>
                  </Pressable>
                )}
              </View>
            </Surface>
          </View>
        </ScrollView>
      )}

      <ExerciseDetailSheet 
        exercise={selectedEx}
        isVisible={!!selectedEx}
        onClose={() => setSelectedEx(null)}
      />
    </ScreenShell>
  );
}

function CoachPlansSection({
    isPremium,
    programs,
    todayWorkoutPlan,
    todayNutritionPlan,
    unscheduledWorkouts,
    unscheduledMeals,
    hasWorkoutToday,
    navigation,
    onSelectExercise,
}: any) {
    if (!isPremium) {
        return (
            <Surface tone="muted" style={[styles.card, { borderStyle: 'dashed', opacity: 0.8 }]}>
                <View style={[styles.cardHeader, { opacity: 0.5 }]}>
                    <Ionicons name="lock-closed" size={18} color={colors.textFaint} />
                    <Typography variant="h2" style={{ color: colors.textFaint }}>Custom Coach Plans</Typography>
                </View>
                <Typography variant="label" color={colors.textDim}>Upgrade to premium to receive personalized training and nutrition plans from your coach.</Typography>
            </Surface>
        );
    }

    const dailyWorkout = todayWorkoutPlan.sourceType === "daily" ? todayWorkoutPlan.payload : null;
    const programWorkout = todayWorkoutPlan.sourceType === "program" ? todayWorkoutPlan.payload : null;
    const visibleWorkout = dailyWorkout ?? programWorkout ?? unscheduledWorkouts[0] ?? null;
    const workoutPrescriptionId = dailyWorkout?.id ?? (!programWorkout ? unscheduledWorkouts[0]?.id : null);
    const visibleMeal = todayNutritionPlan.sourceType === "daily"
        ? todayNutritionPlan.payload
        : unscheduledMeals[0] ?? null;

    return (
        <>
            {programs.length > 0 && (() => {
                const activeProgram = programs[0];
                const completedSessions = activeProgram.weeks.reduce((sum: number, w: any) => sum + w.sessions.filter((s: any) => s.isCompleted).length, 0);
                const totalSessions = activeProgram.weeks.reduce((sum: number, w: any) => sum + w.sessions.length, 0);
                const progressPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

                return (
                    <Surface tone="muted" style={[styles.card, { borderColor: colors.danger, backgroundColor: '#1a1010' }]}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="calendar" size={18} color={colors.danger} />
                            <Typography variant="h2">Active Program</Typography>
                            <View style={[styles.coachBadge, { backgroundColor: colors.danger }]}>
                                <Typography style={{ fontSize: 11, color: '#000', fontWeight: '900' }}>{activeProgram.level}</Typography>
                            </View>
                        </View>
                        <View style={styles.prescribedContent}>
                            <Typography variant="h2" style={{ fontSize: 20 }}>{activeProgram.title}</Typography>
                            <Typography variant="label" color={colors.textMuted}>
                                {activeProgram.startDateKey ? `Starts ${activeProgram.startDateKey}` : "Unscheduled program"} | By {activeProgram.coachName}
                            </Typography>
                        </View>
                        <View style={styles.progressBarTrack}>
                            <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: colors.danger }]} />
                        </View>
                        <Typography variant="label" color={colors.textFaint} style={{ textAlign: I18nManager.isRTL ? 'left' : 'right', fontSize: 11 }}>{progressPct}% · {completedSessions} of {totalSessions}</Typography>
                    </Surface>
                );
            })()}

            {visibleWorkout && (
                <Surface tone="muted" style={[styles.card, { borderColor: colors.primary, backgroundColor: "#1a1a10" }]}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="barbell-outline" size={18} color={colors.primary} />
                        <Typography variant="h2">
                            {todayWorkoutPlan.sourceType !== "none" ? "Today's Workout" : "Unscheduled Workout"}
                        </Typography>
                        <View style={styles.coachBadge}>
                            <Typography style={{ fontSize: 11, color: '#000', fontWeight: '900' }}>COACH ASSIGNED</Typography>
                        </View>
                    </View>
                    <View style={styles.prescribedContent}>
                        <Typography variant="h2" style={{ fontSize: 20 }}>{visibleWorkout.title}</Typography>
                        <Typography variant="label" color={colors.textMuted}>
                            {visibleWorkout.exercises.length} exercises
                            {visibleWorkout.coachName ? ` | By ${visibleWorkout.coachName}` : ""}
                        </Typography>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
                            {visibleWorkout.exercises.map((pEx: any, idx: number) => {
                                const libEx = EXERCISE_LIBRARY.find(l => l.name.en.toLowerCase() === pEx.name.toLowerCase());
                                return (
                                    <Pressable 
                                        key={idx} 
                                        style={styles.previewItem}
                                        onPress={() => libEx && onSelectExercise(libEx)}
                                    >
                                        <View style={styles.previewIcon}>
                                            <Ionicons name="barbell" size={16} color={colors.primary} />
                                        </View>
                                        <Text style={styles.previewText} numberOfLines={1}>{pEx.name}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                    {visibleWorkout.isCompleted || hasWorkoutToday ? (
                        <Typography variant="label" color={colors.success}>Logged today</Typography>
                    ) : (
                        <Pressable
                            style={styles.startPrescribedBtn}
                            onPress={() => ToastService.confirm({
                                title: "Start this session?",
                                message: `${visibleWorkout.title} is ready when you are.`,
                                confirmLabel: "Start now",
                                cancelLabel: "Later",
                                onConfirm: () => workoutPrescriptionId
                                    ? navigation.navigate("Workouts", { autoLoadPrescriptionId: workoutPrescriptionId })
                                    : navigation.navigate("Workouts", { programSession: visibleWorkout }),
                            })}
                        >
                            <Typography style={{ color: colors.primaryText, fontWeight: "900", fontSize: 14 }}>START SESSION</Typography>
                            <Ionicons name="play" size={16} color={colors.primaryText} />
                        </Pressable>
                    )}
                </Surface>
            )}

            {visibleMeal && (
                <Surface tone="muted" style={[styles.card, { borderColor: colors.success, backgroundColor: "#101a14" }]}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="restaurant-outline" size={18} color={colors.success} />
                        <Typography variant="h2">
                            {todayNutritionPlan.sourceType === "daily" ? "Today's Nutrition Plan" : "Unscheduled Nutrition Plan"}
                        </Typography>
                        <View style={[styles.coachBadge, { backgroundColor: colors.success }]}>
                            <Typography style={{ fontSize: 11, color: '#000', fontWeight: '900' }}>COACH ASSIGNED</Typography>
                        </View>
                    </View>
                    <View style={styles.prescribedContent}>
                        <Typography variant="h2" style={{ fontSize: 20 }}>{visibleMeal.title}</Typography>
                        <Typography variant="label" color={colors.textMuted}>
                            {visibleMeal.macros.calories} kcal | {visibleMeal.macros.protein}g Protein
                        </Typography>
                    </View>
                    <Pressable
                        style={[styles.startPrescribedBtn, { backgroundColor: colors.success }]}
                        onPress={() => navigation.navigate("Nutrition")}
                    >
                        <Typography style={{ color: "#000", fontWeight: "900", fontSize: 14 }}>REVIEW PLAN</Typography>
                        <Ionicons name="nutrition" size={16} color="#000" />
                    </Pressable>
                </Surface>
            )}
        </>
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
  greetingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  // Geometry and surface now come from <Surface tone="muted">; this keeps only
  // the internal layout. The per-card colour overrides at the call sites are
  // left untouched here — recolouring those is P1-3, not P1-1.
  card: { gap: spacing.lg },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  statsGrid: { gap: 4 },
  ringContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgDark, padding: spacing.xl, borderRadius: radius["2xl"], borderWidth: 1, borderColor: colors.borderSubtle },
  ringSideStats: { flex: 1, marginStart: 24, gap: 16 },
  sideStatBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  previewRow: { flexDirection: 'row', marginTop: 12, marginBottom: 4 },
  previewItem: { alignItems: 'center', width: 80, gap: 6, marginEnd: 12 },
  previewIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: 'rgba(255,204,0,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,204,0,0.2)' },
  previewText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  
  actionsGrid: { flexDirection: "row", gap: spacing.md },
  actionButton: { flex: 1, flexDirection: "row", backgroundColor: colors.primary, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg, gap: 8 },
  outlinedAction: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  disabledAction: { backgroundColor: "#222", borderColor: "#333", borderWidth: 1 },
  actionButtonText: { color: colors.primaryText, fontWeight: "900", fontSize: 14, textTransform: "uppercase" },

  taskCountPill: { marginStart: "auto", backgroundColor: colors.primaryMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  taskCountText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  taskList: { gap: spacing.md },
  taskItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.bgDark, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle },
  taskInfo: { flex: 1, gap: 4 },
  taskTitle: { fontSize: 14 },
  taskDesc: { fontSize: 11, letterSpacing: 0.6 },
  taskDue: { fontSize: 11, letterSpacing: 0.6 },
  taskActions: { flexDirection: "row", gap: 8 },
  taskActionBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  taskActionComplete: { backgroundColor: colors.primary, borderColor: colors.primary },
  taskActionDismiss: { backgroundColor: "transparent", borderColor: colors.borderStrong },
  moreTasksText: { textAlign: I18nManager.isRTL ? "left" : "right", fontSize: 11 },

  premiumBadge: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, gap: 4, marginStart: 8 },
  coachBadge: { marginStart: "auto", backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.xs },
  prescribedContent: { gap: 4, marginTop: 4 },
  startPrescribedBtn: { backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: radius.md, gap: 10, marginTop: 10 },
  
  progressBarTrack: { height: 6, backgroundColor: colors.borderStrong, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
});
