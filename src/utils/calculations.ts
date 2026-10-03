import type {
  Goal,
  GoalIntensity,
  MacroGrams,
  NutritionPlan,
  UserMetrics,
} from '../types/fitness';

// ---------------------------------------------------------------------------
// Activity level (PAL) & TDEE
// ---------------------------------------------------------------------------

/** Physical-activity-level multipliers applied to BMR: desk job / 1-3 sessions a week / 3-5 sessions / daily intense training. */
const PAL_TIERS = [
  { key: 'sedentary', multiplier: 1.2 },
  { key: 'light', multiplier: 1.35 },
  { key: 'moderate', multiplier: 1.5 },
  { key: 'very_active', multiplier: 1.7 },
] as const;

/** Daily steps at or above this move the user one tier up, below `LOW_STEPS` one tier down - walking matters beyond the gym. */
const HIGH_STEPS = 10_000;
const LOW_STEPS = 4_000;

/**
 * Activity multiplier from the declared weekly resistance sessions (the main driver: 0-1 sedentary, 2-3 light, 4-5 moderate,
 * 6+ very active), nudged one tier up for a very high step count or one tier down for a very low one.
 */
export function getActivityMultiplier(steps: number, trainingDaysPerWeek: number): number {
  const fromTraining = trainingDaysPerWeek >= 6 ? 3 : trainingDaysPerWeek >= 4 ? 2 : trainingDaysPerWeek >= 2 ? 1 : 0;
  const stepShift = steps >= HIGH_STEPS ? 1 : steps < LOW_STEPS ? -1 : 0;
  const tier = Math.min(Math.max(fromTraining + stepShift, 0), PAL_TIERS.length - 1);
  return PAL_TIERS[tier].multiplier;
}

// ---------------------------------------------------------------------------
// BMR (Mifflin-St Jeor)
// ---------------------------------------------------------------------------

/**
 * Mifflin-St Jeor equation:
 *  Men:   BMR = 10*weight(kg) + 6.25*height(cm) - 5*age + 5
 *  Women: BMR = 10*weight(kg) + 6.25*height(cm) - 5*age - 161
 */
export function calculateBMR(metrics: UserMetrics): number {
  const { gender, weightKg, heightCm, age } = metrics;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

/** TDEE = BMR x activity multiplier, rounded to whole kcal. */
export function calculateTDEE(metrics: UserMetrics): number {
  const multiplier = getActivityMultiplier(metrics.averageDailySteps, metrics.trainingDaysPerWeek);
  return Math.round(calculateBMR(metrics) * multiplier);
}

// ---------------------------------------------------------------------------
// Goal-based calorie target
// ---------------------------------------------------------------------------

/** Fixed daily deficit for weight loss. The target never drops below BMR. */
const WEIGHT_LOSS_DEFICIT_KCAL = 400;

/** Recomposition: a slight deficit, as a fraction of TDEE. */
const RECOMP_DEFICIT_FRACTION = 0.05;

/** Lean-bulk ('gain_muscle') daily surplus in kcal: +250 for a clean bulk, more for the aggressive pace. */
const LEAN_BULK_SURPLUS_KCAL: Record<GoalIntensity, number> = {
  moderate: 250,
  aggressive: 400,
};

/** Daily calorie target for a goal: TDEE minus 400 (loss, floored at BMR), TDEE (maintain), or TDEE plus 250 (muscle gain). */
export function calculateTargetCalories(
  tdee: number,
  goal: Goal,
  goalIntensity: GoalIntensity = 'moderate',
  bmr = 0,
): number {
  switch (goal) {
    case 'gain_muscle':
      return Math.round(tdee + LEAN_BULK_SURPLUS_KCAL[goalIntensity]);
    case 'lose_weight':
      return Math.round(Math.max(tdee - WEIGHT_LOSS_DEFICIT_KCAL, bmr));
    case 'recomp':
      return Math.round(Math.max(tdee * (1 - RECOMP_DEFICIT_FRACTION), bmr));
    case 'maintain':
    default:
      return Math.round(tdee);
  }
}

// ---------------------------------------------------------------------------
// Macro split
// ---------------------------------------------------------------------------

/** Grams of protein per kg of bodyweight, tuned per goal. */
const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose_weight: 2.2,
  maintain: 1.8,
  gain_muscle: 2.0,
  recomp: 2.2,
};

/** Fraction of total target calories allocated to fat. */
const FAT_CALORIE_SHARE: Record<Goal, number> = {
  lose_weight: 0.3,
  maintain: 0.3,
  gain_muscle: 0.25,
  recomp: 0.3,
};

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_CARBS = 4;

export function calculateMacros(
  targetCalories: number,
  weightKg: number,
  goal: Goal,
): MacroGrams {
  const proteinG = Math.round(PROTEIN_G_PER_KG[goal] * weightKg);
  const proteinKcal = proteinG * KCAL_PER_G_PROTEIN;

  const fatKcal = targetCalories * FAT_CALORIE_SHARE[goal];
  const fatG = Math.round(fatKcal / KCAL_PER_G_FAT);

  const remainingKcal = Math.max(targetCalories - proteinKcal - fatG * KCAL_PER_G_FAT, 0);
  const carbsG = Math.round(remainingKcal / KCAL_PER_G_CARBS);

  return { proteinG, fatG, carbsG };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Builds the full nutrition plan (BMR, TDEE, target calories, macros) from raw user metrics. */
export function calculateNutritionPlan(metrics: UserMetrics): NutritionPlan {
  const bmr = calculateBMR(metrics);
  const tdee = calculateTDEE(metrics);
  const targetCalories = calculateTargetCalories(tdee, metrics.goal, metrics.goalIntensity, bmr);
  const macros = calculateMacros(targetCalories, metrics.weightKg, metrics.goal);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    macros,
    calorieDeficitOrSurplus: Math.round(targetCalories - tdee),
  };
}
