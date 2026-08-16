export type NutritionTargetStatus = "available" | "absent" | "unknown";

export function isValidNutritionTarget(target: unknown): target is number {
  return typeof target === "number" && Number.isFinite(target) && target > 0;
}

export function calculateNutritionProgress(
  current: number,
  target: number | null | undefined
): { progress: number; percent: number | null } {
  if (!isValidNutritionTarget(target)) {
    return { progress: 0, percent: null };
  }

  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const progress = Math.min(safeCurrent / target, 1);
  return { progress, percent: Math.round(progress * 100) };
}

export function calculateMacroAdherence(
  totalCalories: number,
  target: number | null | undefined
): number | null {
  return calculateNutritionProgress(totalCalories, target).percent;
}
