import { useState, useEffect, useMemo, useCallback } from "react";
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
import {
  isSessionCompleted,
  type CompletionCandidate,
} from "../features/programs/programWorkout";
import { subscribeToPlanRevisions, type PlanRevision } from "../services/planRevisionService";
import { getClientTodayDateKey } from "../utils/dateKeys";
import { useCurrentUser } from "./useCurrentUser";
import { useClientDateKey } from "./useClientDateKey";
import { Ionicons } from "@expo/vector-icons";
import { isProgramCoveringDate, resolvePlanDimension } from "../features/plans/planResolution";
import {
  selectUnscheduled,
  toMealCandidates,
  toActiveScheduledPrograms,
  toScheduledPrograms,
  toWorkoutCandidates,
  type ScheduledPrescribedMeal,
  type ScheduledPrescribedWorkout,
  type ScheduledProgramDoc,
} from "../features/plans/planAdapters";
import type { ProgramSession } from "../services/programService";
import type { NutritionTargetStatus } from "../features/nutrition/nutritionTargets";
import { combineDimensionStatus } from "../features/coaching/dimensionStatus";
import type { DataStatus } from "./useTraineeDetailData";

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
  const [planRevisions, setPlanRevisions] = useState<PlanRevision[]>([]);
  /*
   * Whether the PLAN reads succeeded.
   *
   * The coach's client-day report has carried per-dimension status since Phase
   * 3; the trainee's own Today had none, so a failed prescription read arrived
   * as an empty array and rendered as "no plan" — the same collapse, on the
   * other side of the relationship. Only the two plan sources feed it, because
   * they are the only ones the session card speaks for.
   */
  const [workoutPlanStatus, setWorkoutPlanStatus] = useState<DataStatus>("loading");
  const [programPlanStatus, setProgramPlanStatus] = useState<DataStatus>("loading");
  const [lastMessage, setLastMessage] = useState<ChatThreadSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetryToken, setProfileRetryToken] = useState(0);
  const dateKey = useClientDateKey(profile?.timezone);

  useEffect(() => {
    if (!uid) {
      setIsLoading(false);
      setWorkoutPlanStatus("loaded");
      setProgramPlanStatus("loaded");
      return;
    }

    setWorkoutPlanStatus("loading");
    setProgramPlanStatus("loading");

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
      (emit, onError) => subscribeToPrescriptionHistory(uid, emit, onError),
      (data) => {
        setPrescribed(data);
        setWorkoutPlanStatus("loaded");
      },
      () => setWorkoutPlanStatus("error")
    );

    const unsubPrescribedMeals = subscribeWithCache<PrescribedMeal[]>(
      `prescribedMealHistory:${uid}`,
      (emit) => subscribeToPrescribedMealHistory(uid, emit),
      setPrescribedMeals
    );

    /*
     * Why the plan changed, from the client's side.
     *
     * A coach can now genuinely replace a day's plan (Phase 4), and until this
     * the client had no way to see that it had happened or why — the reason was
     * written into `planRevisions` and read only on the COACH's screen. A plan
     * that changes underneath someone without explanation is the exact
     * complaint the collection was created to answer.
     */
    const unsubRevisions = subscribeWithCache<PlanRevision[]>(
      `planRevisions:${uid}`,
      (emit, onError) => subscribeToPlanRevisions(uid, emit, onError),
      setPlanRevisions
    );

    const unsubCheckInTasks = subscribeWithCache<CheckInTask[]>(
      `openCheckInTasks:${uid}`,
      (emit) => subscribeToOpenCheckInTasks(uid, emit),
      setCheckInTasks
    );

    const unsubProfile = subscribeWithCache<UserProfile | null>(
      `profile:${uid}`,
      (emit, onError) => subscribeToUserProfile(uid, emit, onError),
      (data) => {
        setProfile(data);
        setProfileError(null);
        setIsLoading(false);
      },
      () => {
        setProfile(null);
        setProfileError("We couldn't load your dashboard profile.");
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
      (emit, onError) => subscribeToTraineePrograms(uid, emit, onError),
      (data) => {
        setPrograms(data);
        setProgramPlanStatus("loaded");
      },
      () => setProgramPlanStatus("error")
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
      unsubRevisions();
      unsubProfile();
      unsubMetrics();
      unsubPrograms();
      unsubChat?.();
      unsubThread?.();
    };
  }, [uid, dateKey, profile?.activeAssignmentId, profileRetryToken]);

  useEffect(() => {
    if (!uid) return;
    setIsLoading(true);
  }, [uid]);

  const isPremium = profile?.isPremium === true;

  const retryProfile = useCallback(() => {
    setProfileError(null);
    setIsLoading(true);
    setWorkoutPlanStatus("loading");
    setProgramPlanStatus("loading");
    setProfileRetryToken((value) => value + 1);
  }, []);

  const nutritionStats = useMemo(() => {
    const totalCals = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    /*
     * Null, never 2,100.
     *
     * `profile?.macroTargets?.calories || 2100` gave every trainee without a
     * target the same invented one — and `|| ` also swallowed a legitimate 0.
     * `target` is now the honest shape and every consumer handles null.
     */
    const rawTarget = profile?.macroTargets?.calories;
    const targetCals =
      typeof rawTarget === "number" && Number.isFinite(rawTarget) && rawTarget > 0
        ? rawTarget
        : null;
    const targetStatus: NutritionTargetStatus = profileError
      ? "unknown"
      : targetCals === null
        ? "absent"
        : "available";
    return { current: totalCals, target: targetCals, targetStatus };
  }, [meals, profile, profileError]);

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
    // Exactly one eligible program participates in resolution.
    programs: toActiveScheduledPrograms(scheduledPrograms as ScheduledProgramDoc[], dateKey),
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
      nutritionTargetStatus: nutritionStats.targetStatus,
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
  }, [metrics, nutritionStats.current, nutritionStats.target, nutritionStats.targetStatus, todayWorkoutPlan.sourceType, todayNutritionPlan.sourceType, unscheduledWorkouts.length, unscheduledMeals.length, profile?.selectedCoachId, profile?.timezone, workouts.length, dateKey, lastMessage, uid]);

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

    /*
     * "Under 60% of target" is only a question that can be asked when a target
     * exists. Without one this branch is skipped entirely rather than compared
     * against null — `null * 0.6` is 0, which would have quietly made the
     * condition permanently false anyway, but for the wrong reason.
     */
    if (nutritionStats.target !== null && nutritionStats.current < nutritionStats.target * 0.6) {
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

  /**
   * The revision that explains TODAY's plan, if there is one.
   *
   * Matched on the exact client date key, because an adjustment replaces one
   * day and no other — showing yesterday's reason against today's plan would
   * restate the very thing the Phase 4 copy is careful not to claim.
   */
  const todayPlanRevisions = useMemo(
    () => planRevisions.filter((revision) => revision.effectiveFromDateKey === dateKey),
    [planRevisions, dateKey]
  );

  /**
   * The load state of today's plan, in the three-way form the rest of the app
   * uses. `loaded` never means "empty" — that distinction is the caller's.
   */
  const planStatus = combineDimensionStatus([workoutPlanStatus, programPlanStatus]);

  /**
   * True when a published program's range covers today.
   *
   * The one input that separates a rest day from having no plan: the resolver
   * returns `sourceType: "none"` for both.
   */
  /**
   * Whether TODAY's program session has actually been submitted.
   *
   * Derived from source-matched workout logs, never from
   * `ProgramSession.isCompleted` — that field lives inside the coach-authored
   * program document, which the trainee cannot write. Matching on all four
   * parts is what stops an unrelated workout on the same day from closing the
   * card.
   */
  const isTodayProgramSessionCompleted = useMemo(() => {
    if (todayWorkoutPlan.sourceType !== "program") return false;
    const sessionId = (todayWorkoutPlan.payload as { id?: string })?.id;
    if (!sessionId) return false;
    return isSessionCompleted(
      workouts as unknown as CompletionCandidate[],
      todayWorkoutPlan.sourceId,
      sessionId,
      dateKey,
    );
  }, [todayWorkoutPlan, workouts, dateKey]);

  const hasProgramCoveringToday = useMemo(
    () => toActiveScheduledPrograms(programs as ScheduledProgramDoc[], dateKey)
      .some((program) => isProgramCoveringDate(program, dateKey)),
    [programs, dateKey]
  );

  return {
    dateKey,
    isTodayProgramSessionCompleted,
    planStatus,
    hasProgramCoveringToday,
    todayPlanRevisions,
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
    profileError,
    retryProfile,
    isPremium,
    nutritionStats,
    workoutStatus,
    greeting,
    todayMission,
    primaryAction,
  };
}
