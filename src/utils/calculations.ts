import type { Gender, Goal, GoalIntensity, MacroGrams, NutritionPlan, UserMetrics } from '../types/fitness';

// ---------------------------------------------------------------------------
// Activity multiplier (PAL)
// ---------------------------------------------------------------------------

/**
 * Activity multiplier from the daily step level, plus 0.05 for a heavy training week (4+ sessions).
 *
 * The base value follows four reference levels - 1.20 up to 2,000 steps, 1.35 at 5,250, 1.45 at 8,000 and 1.55 from 11,000 up - which are the
 * middle of the older fixed bands (under 4,000 / 4,000-6,499 / 6,500-9,499 / 9,500+), and rises in a straight line between them. So every step
 * count moves the estimate a little, instead of nothing happening until a band edge is crossed and then a jump of 0.1 (about 170 kcal).
 */
const STEP_ACTIVITY_POINTS: ReadonlyArray<readonly [steps: number, pal: number]> = [
  [2000, 1.2],
  [5250, 1.35],
  [8000, 1.45],
  [11000, 1.55],
];

export function getActivityMultiplier(dailySteps: number, workoutDaysPerWeek: number): number {
  const first = STEP_ACTIVITY_POINTS[0];
  const last = STEP_ACTIVITY_POINTS[STEP_ACTIVITY_POINTS.length - 1];
  let pal = last[1];
  if (dailySteps <= first[0]) {
    pal = first[1];
  } else if (dailySteps < last[0]) {
    for (let i = 1; i < STEP_ACTIVITY_POINTS.length; i++) {
      const [toSteps, toPal] = STEP_ACTIVITY_POINTS[i];
      if (dailySteps <= toSteps) {
        const [fromSteps, fromPal] = STEP_ACTIVITY_POINTS[i - 1];
        pal = fromPal + ((toPal - fromPal) * (dailySteps - fromSteps)) / (toSteps - fromSteps);
        break;
      }
    }
  }

  if (workoutDaysPerWeek >= 4) pal += 0.05;
  return pal;
}

// ---------------------------------------------------------------------------
// BMR (Mifflin-St Jeor)
// ---------------------------------------------------------------------------

/**
 * Mifflin-St Jeor equation:
 *  Men:   BMR = 10*weight(kg) + 6.25*height(cm) - 5*age + 5
 *  Women: BMR = 10*weight(kg) + 6.25*height(cm) - 5*age - 161
 * (a 166 kcal gap between a man and a woman with the same measurements).
 */
function mifflinStJeor(gender: Gender, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (gender === 'male' ? 5 : -161);
}

export function calculateBMR(metrics: UserMetrics): number {
  return mifflinStJeor(metrics.gender, metrics.weightKg, metrics.heightCm, metrics.age);
}

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_CARBS = 4;

/**
 * Gender-aware split: protein 2.0 g/kg for men, 1.8 g/kg for women; fat 0.9 g/kg for men and 1.0 g/kg for women (hormonal
 * balance matters most for women); carbohydrates take all the remaining calories (never negative).
 */
export function calculateMacros(targetCalories: number, weightKg: number, gender: Gender): MacroGrams {
  const proteinG = Math.round(weightKg * (gender === 'male' ? 2.0 : 1.8));
  const fatG = Math.round(weightKg * (gender === 'female' ? 1.0 : 0.9));
  const remainingKcal = targetCalories - proteinG * KCAL_PER_G_PROTEIN - fatG * KCAL_PER_G_FAT;
  const carbsG = Math.max(0, Math.round(remainingKcal / KCAL_PER_G_CARBS));
  return { proteinG, fatG, carbsG };
}

// ---------------------------------------------------------------------------
// Unified calculation
// ---------------------------------------------------------------------------

export type CalorieGoal = 'lean_bulk' | 'bulk' | 'maintenance' | 'cut' | 'aggressive_cut' | 'recomp';

/** Slight deficit for body recomposition, as a fraction of TDEE (never below BMR). */
const RECOMP_DEFICIT_FRACTION = 0.05;

/**
 * BMR (Mifflin-St Jeor, by gender) -> TDEE (activity multiplier) -> goal calories -> gender-aware macros.
 *  lean_bulk: TDEE + 220 (a stable 200-250 kcal; 120 is lost in NEAT swings and food-label error)
 *  bulk: TDEE + 400
 *  maintenance: TDEE
 *  cut: TDEE - 400, aggressive_cut: TDEE - 550 - both never below BMR
 *  recomp: TDEE - 5%, never below BMR
 */
export function calculatePreciseNutrition(params: {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  age: number;
  dailyStepGoal: number;
  workoutDaysPerWeek: number;
  goal: CalorieGoal;
}) {
  const { gender, weightKg, heightCm, age, dailyStepGoal, workoutDaysPerWeek, goal } = params;

  const bmr = mifflinStJeor(gender, weightKg, heightCm, age);
  const tdee = Math.round(bmr * getActivityMultiplier(dailyStepGoal, workoutDaysPerWeek));

  let targetCalories = tdee;
  if (goal === 'lean_bulk') {
    targetCalories = Math.round(tdee + 220);
  } else if (goal === 'bulk') {
    targetCalories = Math.round(tdee + 400);
  } else if (goal === 'cut') {
    targetCalories = Math.max(Math.round(tdee - 400), Math.round(bmr));
  } else if (goal === 'aggressive_cut') {
    targetCalories = Math.max(Math.round(tdee - 550), Math.round(bmr));
  } else if (goal === 'recomp') {
    targetCalories = Math.max(Math.round(tdee * (1 - RECOMP_DEFICIT_FRACTION)), Math.round(bmr));
  }

  const { proteinG, fatG, carbsG } = calculateMacros(targetCalories, weightKg, gender);

  return {
    bmr: Math.round(bmr),
    tdee,
    targetCalories,
    proteinGrams: proteinG,
    carbGrams: carbsG,
    fatGrams: fatG,
  };
}

/** The app's goal setting expressed as a calorie goal ('gain_muscle' is a lean bulk, or a faster bulk at the aggressive pace). */
function toCalorieGoal(goal: Goal, intensity: GoalIntensity | undefined): CalorieGoal {
  switch (goal) {
    case 'gain_muscle':
      return intensity === 'aggressive' ? 'bulk' : 'lean_bulk';
    case 'lose_weight':
      return 'cut';
    case 'recomp':
      return 'recomp';
    case 'maintain':
    default:
      return 'maintenance';
  }
}

/** Builds the full nutrition plan (BMR, TDEE, target calories, macros) from raw user metrics. */
export function calculateNutritionPlan(metrics: UserMetrics): NutritionPlan {
  const result = calculatePreciseNutrition({
    gender: metrics.gender,
    weightKg: metrics.weightKg,
    heightCm: metrics.heightCm,
    age: metrics.age,
    dailyStepGoal: metrics.averageDailySteps,
    workoutDaysPerWeek: metrics.trainingDaysPerWeek,
    goal: toCalorieGoal(metrics.goal, metrics.goalIntensity),
  });

  return {
    bmr: result.bmr,
    tdee: result.tdee,
    targetCalories: result.targetCalories,
    macros: { proteinG: result.proteinGrams, fatG: result.fatGrams, carbsG: result.carbGrams },
    calorieDeficitOrSurplus: result.targetCalories - result.tdee,
  };
}
