import type {
  ActivityLevel,
  Goal,
  GoalIntensity,
  MacroGrams,
  NutritionPlan,
  UserMetrics,
} from '../types/fitness';

// ---------------------------------------------------------------------------
// Activity level & TDEE multipliers
// ---------------------------------------------------------------------------

/** Derives a NEAT-based activity level from average daily step count. */
export function getActivityLevelFromSteps(steps: number): ActivityLevel {
  if (steps < 5_000) return 'sedentary';
  if (steps < 8_000) return 'light';
  return 'active';
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.15, // under 5,000 steps
  light: 1.25, // 5,000 - 8,000 steps
  active: 1.35, // over 8,000 steps
};

/** Extra thermic bonus per weekly resistance-training session, on top of NEAT. */
const TRAINING_DAY_BONUS = 0.05;

/**
 * Combined activity multiplier: NEAT (from steps) plus a bonus for the
 * declared weekly resistance-training frequency, so a low step count doesn't
 * drown out several weekly training sessions (e.g. 4,800 steps + 3 sessions
 * should land around 1.3-1.4, not be flattened to a plain "sedentary" 1.15).
 */
export function getActivityMultiplier(
  steps: number,
  trainingDaysPerWeek: number,
): number {
  const base = ACTIVITY_MULTIPLIERS[getActivityLevelFromSteps(steps)];
  const trainingBonus = trainingDaysPerWeek * TRAINING_DAY_BONUS;
  return base + trainingBonus;
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

export function calculateTDEE(metrics: UserMetrics): number {
  const bmr = calculateBMR(metrics);
  const multiplier = getActivityMultiplier(
    metrics.averageDailySteps,
    metrics.trainingDaysPerWeek,
  );
  return bmr * multiplier;
}

// ---------------------------------------------------------------------------
// Goal-based calorie target
// ---------------------------------------------------------------------------

/** Fractional calorie adjustment applied to TDEE, for every goal except the lean-bulk ('gain_muscle'). */
const GOAL_CALORIE_ADJUSTMENT: Record<Exclude<Goal, 'gain_muscle'>, number> = {
  lose_weight: -0.2, // ~20% deficit
  maintain: 0,
  recomp: -0.05, // slight deficit, body recomposition
};

/** Lean-bulk ('gain_muscle') calorie surplus, as a fraction of TDEE. */
const LEAN_BULK_SURPLUS_FRACTION: Record<GoalIntensity, number> = {
  moderate: 0.1,
  aggressive: 0.12,
};

function calculateLeanBulkSurplus(tdee: number, intensity: GoalIntensity): number {
  return tdee * LEAN_BULK_SURPLUS_FRACTION[intensity];
}

export function calculateTargetCalories(
  tdee: number,
  goal: Goal,
  goalIntensity: GoalIntensity = 'moderate',
): number {
  if (goal === 'gain_muscle') {
    return Math.round(tdee + calculateLeanBulkSurplus(tdee, goalIntensity));
  }
  const adjustment = GOAL_CALORIE_ADJUSTMENT[goal];
  return Math.round(tdee * (1 + adjustment));
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
  const targetCalories = calculateTargetCalories(tdee, metrics.goal, metrics.goalIntensity);
  const macros = calculateMacros(targetCalories, metrics.weightKg, metrics.goal);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    macros,
    calorieDeficitOrSurplus: Math.round(targetCalories - tdee),
  };
}
