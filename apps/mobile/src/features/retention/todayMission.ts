import type { NutritionTargetStatus } from "../nutrition/nutritionTargets";

export type TodayMissionItemId = "workout" | "nutrition" | "coach" | "bodyMetric";

export type TodayMissionItem = {
  id: TodayMissionItemId;
  title: string;
  subtitle: string;
  icon: string;
  isComplete: boolean;
  priority: number;
};

export type TodayMission = {
  completionPercent: number;
  completedCount: number;
  totalCount: number;
  items: TodayMissionItem[];
};

type BuildTodayMissionInput = {
  hasWorkoutToday: boolean;
  caloriesLogged: number;
  /**
   * The trainee's calorie target, or null when they have none.
   *
   * Was `number`, defaulted with `input.calorieTarget || 2100`. That printed
   * "0/2100 kcal logged" to a trainee who had never been given a target — a
   * denominator nobody set, presented as their goal. Null is the honest shape;
   * the copy below adapts rather than inventing one.
   */
  calorieTarget: number | null;
  nutritionTargetStatus?: NutritionTargetStatus;
  hasCoachAssigned: boolean;
  hasMessagedToday: boolean;
  hasPendingWorkoutPlan: boolean;
  hasPendingMealPlan: boolean;
  hasBodyMetricToday: boolean;
};

export function buildTodayMission(input: BuildTodayMissionInput): TodayMission {
  /*
   * The mission item is COMPLETE when food was logged, because the mission is
   * "log your nutrition" and they did. What it must never do is describe that
   * as adherence: logging food proves logging, not compliance, and against a
   * target that may not exist there is nothing to be on track toward.
   */
  const caloriesLogged = Number.isFinite(input.caloriesLogged) ? Math.max(0, input.caloriesLogged) : 0;
  const hasLoggedCalories = caloriesLogged > 0;

  /*
   * A target only counts if it is a real, positive, finite number. A zero or
   * negative target would produce "X/0 kcal" and, anywhere a ratio is taken,
   * a divide-by-zero or Infinity.
   */
  const calorieTarget =
    typeof input.calorieTarget === "number" &&
    Number.isFinite(input.calorieTarget) &&
    input.calorieTarget > 0
      ? input.calorieTarget
      : null;

  /*
   * Four factual sentences, none of which claims progress toward a target that
   * does not exist. "Nutrition is on track" is gone: it fired on
   * `caloriesLogged > 0`, so a single 40 kcal coffee against an unknown target
   * reported the day as on track.
   */
  const nutritionTargetStatus = input.nutritionTargetStatus
    ?? (calorieTarget === null ? "absent" : "available");
  const nutritionSubtitle = nutritionTargetStatus === "unknown"
    ? "Nutrition target unavailable"
    : calorieTarget !== null
      ? `${caloriesLogged}/${calorieTarget} kcal logged`
      : hasLoggedCalories
        ? `${caloriesLogged} kcal logged`
        : "No nutrition targets set";

  const unsortedItems: TodayMissionItem[] = [
    {
      id: "workout",
      title: input.hasPendingWorkoutPlan ? "Complete coach session" : "Log today's workout",
      subtitle: input.hasWorkoutToday ? "Training complete" : input.hasPendingWorkoutPlan ? "Coach plan is waiting" : "keep your streak alive",
      icon: input.hasWorkoutToday ? "checkmark-circle" : "barbell-outline",
      isComplete: input.hasWorkoutToday,
      priority: input.hasPendingWorkoutPlan ? 1 : 2,
    },
    {
      id: "nutrition",
      title: input.hasPendingMealPlan ? "Review nutrition plan" : "Log nutrition",
      subtitle: nutritionSubtitle,
      icon: hasLoggedCalories ? "checkmark-circle" : "nutrition-outline",
      isComplete: hasLoggedCalories,
      priority: input.hasPendingMealPlan ? 1 : 3,
    },
    {
      id: "bodyMetric",
      title: "Update body signal",
      subtitle: input.hasBodyMetricToday ? "Today's body metric saved" : "Add weight or progress data",
      icon: input.hasBodyMetricToday ? "checkmark-circle" : "speedometer-outline",
      isComplete: input.hasBodyMetricToday,
      priority: 5,
    },
  ];

  if (input.hasCoachAssigned) {
    unsortedItems.push({
      id: "coach",
      title: "Talk to your coach",
      subtitle: input.hasMessagedToday ? "Message sent today" : "Keep accountability warm",
      icon: input.hasMessagedToday ? "checkmark-circle" : "chatbubble-ellipses-outline",
      isComplete: input.hasMessagedToday,
      priority: 4,
    });
  }

  const items = unsortedItems.sort((a, b) => Number(a.isComplete) - Number(b.isComplete) || a.priority - b.priority);

  const completedCount = items.filter((item) => item.isComplete).length;
  const totalCount = items.length;
  const completionPercent = Math.round((completedCount / totalCount) * 100);

  return {
    completionPercent,
    completedCount,
    totalCount,
    items,
  };
}
