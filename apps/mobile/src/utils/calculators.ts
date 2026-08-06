import { OnboardingData } from '../types/onboarding';

export interface CalculatedPlan {
  calories: number;
  protein: number; 
  carbs: number;
  fats: number;
  bmr: number;
  tdee: number;
}

/**
 * Calculates Age from YYYY-MM-DD string
 */
export const calculateAge = (birthday: string): number => {
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * FYTRAK CALORIE ENGINE
 * Using Mifflin-St Jeor Formula
 */
export const calculateNutritionPlan = (data: OnboardingData): CalculatedPlan => {
  const { gender, height, weight, birthday, goal, level } = data;
  const age = calculateAge(birthday);

  // 1. Calculate BMR (Basal Metabolic Rate)
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  bmr = gender === 'male' ? bmr + 5 : bmr - 161;

  // 2. Activity Multiplier (TDEE: Total Daily Energy Expenditure)
  // Maps onboarding 'level' to activity factor
  let multiplier = 1.2; // Sedentary baseline
  switch (level?.toLowerCase()) {
    case 'beginner':     multiplier = 1.375; break; // Lightly active
    case 'intermediate': multiplier = 1.55;  break; // Moderately active
    case 'advanced':     multiplier = 1.725; break; // Very active
    default:             multiplier = 1.375;
  }

  const tdee = Math.round(bmr * multiplier);

  // 3. Goal Adjustment (Caloric Surplus / Deficit)
  let targetCalories = tdee;
  switch (goal?.toLowerCase()) {
    case 'lose_weight':
      targetCalories = tdee - 500; break; // Standard aggressive deficit
    case 'build_muscle':
      targetCalories = tdee + 300; break; // Lean bulk surplus
    case 'get_fit':
    case 'athletic_performance':
      targetCalories = tdee; break; // Maintenance + performance focus
  }

  // Safety floor: extreme-but-reachable onboarding inputs (very low
  // height/weight combined with an older age and a "lose weight" goal) can
  // otherwise drive BMR/TDEE below zero, which would cascade into negative
  // carb/fat targets below. Never recommend below a conservative minimum.
  const MIN_TARGET_CALORIES = 1200;
  targetCalories = Math.max(MIN_TARGET_CALORIES, targetCalories);

  // 4. Macro Calculation (Expert Industry Standard)
  // Protein: 2.2g per kg (High protein for recovery)
  const proteinGrams = Math.max(0, Math.round(weight * 2.2));
  const proteinCalories = proteinGrams * 4;

  // Fats: 25% of total calories
  const fatCalories = targetCalories * 0.25;
  const fatGrams = Math.max(0, Math.round(fatCalories / 9));

  // Carbs: The remaining calories (clamped — protein alone could theoretically
  // exceed a floored, very low calorie target for a very light user)
  const remainingCalories = targetCalories - proteinCalories - fatCalories;
  const carbGrams = Math.max(0, Math.round(remainingCalories / 4));

  return {
    calories: Math.round(targetCalories),
    protein: proteinGrams,
    carbs: carbGrams,
    fats: fatGrams,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee)
  };
};
