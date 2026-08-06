import { useState, useEffect, useMemo } from "react";
import { subscribeWithCache } from "../data/subscriptions/subscriptionCache";
import {
  subscribeToDailyMeals,
  subscribeToDailyWorkouts,
  subscribeToUserProfile,
  subscribeToPrescriptionHistory,
  subscribeToPrescribedMealHistory,
  subscribeToOpenCheckInTasks,
  subscribeToLatestMetrics,
  subscribeToTraineePrograms,
  type Meal,
  type WorkoutLog,
  type UserProfile,
  type PrescribedWorkout,
  type PrescribedMeal,
  type BodyMetric,
  type Program,
  type CheckInTask
} from "../services/userSession";
import {
  subscribeToAssignmentThreadId,
  subscribeToLatestMessage,
  type ChatThreadSummary,
} from "../services/chatService";
import { buildTodayMission } from "../features/retention/todayMission";
import { getClientTodayDateKey } from "../utils/dateKeys";
import { useCurrentUser } from "./useCurrentUser";
import { useClientDateKey } from "./useClientDateKey";
import { Ionicons } from "@expo/vector-icons";
import { resolvePlanDimension } from "../features/plans/planResolution";
import {
  selectUnscheduled,
  toMealCandidates,
  toScheduledPrograms,
  toWorkoutCandidates,
  type ScheduledPrescribedMeal,
  type ScheduledPrescribedWorkout,
  type ScheduledProgramDoc,
} from "../features/plans/planAdapters";
import type { ProgramSession } from "../services/programService";

export type DashboardAction = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  actionLabel: string;
  actionType: "workout" | "nutrition" | "chat" | "progress" | "workout_prescription";
  payload?: any;
};

export function useTraineeDashboard() {
  const uid = useCurrentUser();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prescribed, setPrescribed] = useState<PrescribedWorkout[]>([]);
  const [prescribedMeals, setPrescribedMeals] = useState<PrescribedMeal[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [checkInTasks, setCheckInTasks] = useState<CheckInTask[]>([]);
  const [lastMessage, setLastMessage] = useState<ChatThreadSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dateKey = useClientDateKey(profile?.timezone);

  useEffect(() => {
    if (!uid) return;

    const unsubMeals = subscribeWithCache<Meal[]>(
      `dailyMeals:${uid}:${dateKey}`,
      (emit) => subscribeToDailyMeals(uid, dateKey, emit),
      setMeals
    );

    const unsubWorkouts = subscribeWithCache<WorkoutLog[]>(
      `dailyWorkouts:${uid}:${dateKey}`,
      (emit) => subscribeToDailyWorkouts(uid, dateKey, emit),
      setWorkouts
    );

    const unsubPrescribed = subscribeWithCache<PrescribedWorkout[]>(
      `prescriptionHistory:${uid}`,
      (emit) => subscribeToPrescriptionHistory(uid, emit),
      setPrescribed
    );

    const unsubPrescribedMeals = subscribeWithCache<PrescribedMeal[]>(
      `prescribedMealHistory:${uid}`,
      (emit) => subscribeToPrescribedMealHistory(uid, emit),
      setPrescribedMeals
    );

    const unsubCheckInTasks = subscribeWithCache<CheckInTask[]>(
      `openCheckInTasks:${uid}`,
      (emit) => subscribeToOpenCheckInTasks(uid, emit),
      setCheckInTasks
    );

    const unsubProfile = subscribeWithCache<UserProfile>(
      `profile:${uid}`,
      (emit) => subscribeToUserProfile(uid, emit),
      (data) => {
        setProfile(data);
        setIsLoading(false);
      }
    );

    const unsubMetrics = subscribeWithCache<BodyMetric[]>(
      `latestMetrics:${uid}`,
      (emit) => subscribeToLatestMetrics(uid, emit),
      setMetrics
    );

    const unsubPrograms = subscribeWithCache<Program[]>(
      `programs:${uid}`,
      (emit) => subscribeToTraineePrograms(uid, emit),
      setPrograms
    );

    let unsubChat: (() => void) | undefined;
    let unsubThread: (() => void) | undefined;
    if (profile?.activeAssignmentId) {
      unsubThread = subscribeToAssignmentThreadId(profile.activeAssignmentId, (threadId) => {
        unsubChat?.();
        unsubChat = undefined;
        setLastMessage(null);
        if (threadId) unsubChat = subscribeToLatestMessage(threadId, setLastMessage);
      });
    }

    return () => {
      unsubMeals();
      unsubWorkouts();
      unsubPrescribed();
      unsubPrescribedMeals();
      unsubCheckInTasks();
      unsubProfile();
      unsubMetrics();
      unsubPrograms();
      unsubChat?.();
      unsubThread?.();
    };
  }, [uid, dateKey, profile?.activeAssignmentId]);

  useEffect(() => {
    if (!uid) return;
    setIsLoading(true);
  }, [uid]);

  const isPremium = profile?.isPremium === true;

  const nutritionStats = useMemo(() => {
    const totalCals = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const targetCals = profile?.macroTargets?.calories || 2100;
    return { current: totalCals, target: targetCals };
  }, [meals, profile]);

  const workoutStatus = useMemo(() => {
    return workouts.length > 0 ? "Completed" : "Pending";
  }, [workouts]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const scheduledWorkouts = prescribed as ScheduledPrescribedWorkout[];
  const scheduledMeals = prescribedMeals as ScheduledPrescribedMeal[];
  const scheduledPrograms = programs as ScheduledProgramDoc[];

  const todayWorkoutPlan = useMemo(() => resolvePlanDimension<
    ScheduledPrescribedWorkout | ProgramSession,
    ProgramSession
  >({
    dateKey,
    dailyCandidates: toWorkoutCandidates(scheduledWorkouts),
    programs: toScheduledPrograms(scheduledPrograms),
    toProgramPayload: (session) => session.payload,
  }), [dateKey, prescribed, programs]);

  const todayNutritionPlan = useMemo(() => resolvePlanDimension({
    dateKey,
    dailyCandidates: toMealCandidates(scheduledMeals),
  }), [dateKey, prescribedMeals]);

  const unscheduledWorkouts = useMemo(
    () => selectUnscheduled(scheduledWorkouts).filter((workout) => workout.isCompleted !== true),
    [prescribed]
  );
  const unscheduledMeals = useMemo(
    () => selectUnscheduled(scheduledMeals).filter((meal) => meal.isApplied !== true),
    [prescribedMeals]
  );

  const todayMission = useMemo(() => {
    const today = dateKey;
    const latestMetricDate = metrics[0]?.date;
    const lastMessageDate = lastMessage?.lastMessageAt
      ? new Date(lastMessage.lastMessageAt)
      : null;

    const hasMessagedToday = lastMessage &&
      lastMessageDate &&
      !Number.isNaN(lastMessageDate.getTime()) &&
      getClientTodayDateKey(profile?.timezone, lastMessageDate) === today &&
      lastMessage.lastSenderId === uid;

    return buildTodayMission({
      hasWorkoutToday: workouts.length > 0,
      caloriesLogged: nutritionStats.current,
      calorieTarget: nutritionStats.target,
      hasCoachAssigned: !!profile?.selectedCoachId,
      hasMessagedToday: !!hasMessagedToday,
      hasPendingWorkoutPlan:
        (todayWorkoutPlan.sourceType !== "none" && todayWorkoutPlan.payload.isCompleted !== true)
        || unscheduledWorkouts.length > 0,
      hasPendingMealPlan:
        (todayNutritionPlan.sourceType !== "none" && todayNutritionPlan.payload.isApplied !== true)
        || unscheduledMeals.length > 0,
      hasBodyMetricToday: latestMetricDate === today,
    });
  }, [metrics, nutritionStats.current, nutritionStats.target, todayWorkoutPlan.sourceType, todayNutritionPlan.sourceType, unscheduledWorkouts.length, unscheduledMeals.length, profile?.selectedCoachId, profile?.timezone, workouts.length, dateKey, lastMessage, uid]);

  const primaryAction = useMemo((): DashboardAction => {
    const dailyWorkout = todayWorkoutPlan.sourceType === "daily"
      && todayWorkoutPlan.payload.isCompleted !== true
      ? todayWorkoutPlan.payload as ScheduledPrescribedWorkout
      : null;
    const standingWorkout = unscheduledWorkouts[0] ?? null;
    const actionablePrescription = dailyWorkout ?? standingWorkout;

    if (actionablePrescription && workouts.length === 0) {
      return {
        eyebrow: dailyWorkout ? "Today's coach plan" : "Unscheduled coach plan",
        title: actionablePrescription.title,
        subtitle: `${actionablePrescription.exercises.length} exercises ready`,
        icon: "play",
        actionLabel: "Start session",
        actionType: "workout_prescription",
        payload: { prescriptionId: actionablePrescription.id }
      };
    }

    if (
      todayWorkoutPlan.sourceType === "program"
      && todayWorkoutPlan.payload.isCompleted !== true
      && workouts.length === 0
    ) {
      return {
        eyebrow: "Today's program",
        title: todayWorkoutPlan.payload.title,
        subtitle: `${todayWorkoutPlan.payload.exercises.length} exercises planned`,
        icon: "barbell",
        actionLabel: "Open workouts",
        actionType: "workout",
        payload: { programSession: todayWorkoutPlan.payload }
      };
    }

    if (workouts.length === 0) {
      return {
        eyebrow: "Training focus",
        title: "Log today's workout",
        subtitle: "Keep the streak alive with a fast session log.",
        icon: "barbell",
        actionLabel: "Start workout",
        actionType: "workout"
      };
    }

    if (nutritionStats.current < nutritionStats.target * 0.6) {
      return {
        eyebrow: "Recovery support",
        title: "Log nutrition",
        subtitle: `${nutritionStats.current}/${nutritionStats.target} kcal tracked today`,
        icon: "nutrition",
        actionLabel: "Open nutrition",
        actionType: "nutrition"
      };
    }

    if (profile?.assignmentStatus === "assigned") {
      return {
        eyebrow: "Accountability",
        title: "Send a coach update",
        subtitle: "Share how the session felt while it is fresh.",
        icon: "chatbubble-ellipses",
        actionLabel: "Ask coach",
        actionType: "chat"
      };
    }

    return {
      eyebrow: "Transformation",
      title: "Review progress",
      subtitle: "See what your consistency is building.",
      icon: "stats-chart",
      actionLabel: "View progress",
      actionType: "progress"
    };
  }, [todayWorkoutPlan, unscheduledWorkouts, workouts.length, nutritionStats.current, nutritionStats.target, profile?.assignmentStatus]);

  return {
    meals,
    workouts,
    profile,
    prescribed,
    prescribedMeals,
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
  };
}
