import type { Gender, Goal, GoalIntensity, MacroGrams, NutritionPlan, UserMetrics } from '../types/fitness';
import { estimateStepCalories } from './stepsCalculations';

// ---------------------------------------------------------------------------
// Daily energy expenditure (TDEE)
// ---------------------------------------------------------------------------

/**
 * Everyday life of a free-living adult: 1.4 x BMR. That is the bottom of the "sedentary or light activity" category (PAL 1.40-1.69) in the FAO/WHO/UNU
 * energy requirements report, which is built from doubly labeled water measurements of how much people actually spend. The old textbook figure of
 * 1.2 describes someone who barely moves and is below what free-living adults measure, so building walking and training on top of it fell short.
 */
const BASE_ACTIVITY_FACTOR = 1.4;

/** The everyday figure above already includes ordinary walking up to about this many steps a day; only steps beyond it are added. */
export const BASELINE_DAILY_STEPS = 4000;

/** Bump when the TDEE model changes: stored plans calculated with an older model are recalculated once when the app loads. */
export const NUTRITION_FORMULA_VERSION = 1;

/** Net energy of one strength session (about an hour, rest periods included) for a 70 kg person, a conventional estimate rather than a measurement; it scales with body weight like walking does. */
export const KCAL_PER_TRAINING_SESSION = 250;

/** Steps beyond this are not counted: the step average comes from a typed-in number, and an extreme one would swamp the estimate. */
const MAX_COUNTED_STEPS = 30000;

export interface EnergyBreakdown {
  /** BMR x 1.4: daily life of a free-living adult, including ordinary walking. */
  baseKcal: number;
  /** Walking beyond the ordinary, from the steps above the baseline and body weight (the same per-step cost the step tracker uses). */
  stepsKcal: number;
  /** The training sessions of the week, averaged per day. */
  trainingKcal: number;
  /** The sum, rounded. */
  tdee: number;
}

/**
 * Estimated daily energy expenditure as three parts that add up: daily life, walking beyond the ordinary, and training. Each step above the
 * baseline and each weekly session therefore moves the estimate a little, and one thousand steps are worth the same here as in the step tracker and the weekly balance.
 * Walking and training both scale with body weight, which is what the research on men and women supports: the net cost of walking is the same
 * for both sexes once body mass is accounted for, and the difference in total expenditure between the sexes is mostly lean mass, which the
 * BMR formula already captures with its sex-specific constant. Like every formula it is an average: individual metabolism differs by roughly 10%, which is what the personal calibration corrects.
 */
export function estimateEnergyExpenditure(params: { bmr: number; weightKg: number; dailySteps: number; trainingDaysPerWeek: number }): EnergyBreakdown {
  const baseKcal = params.bmr * BASE_ACTIVITY_FACTOR;
  const countedSteps = Math.max(Math.min(params.dailySteps, MAX_COUNTED_STEPS) - BASELINE_DAILY_STEPS, 0);
  const stepsKcal = estimateStepCalories(countedSteps, params.weightKg);
  const trainingKcal = (Math.max(params.trainingDaysPerWeek, 0) * KCAL_PER_TRAINING_SESSION * (params.weightKg / 70)) / 7;
  return {
    baseKcal: Math.round(baseKcal),
    stepsKcal,
    trainingKcal: Math.round(trainingKcal),
    tdee: Math.round(baseKcal + stepsKcal + trainingKcal),
  };
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
 * BMR (Mifflin-St Jeor, by gender) -> TDEE (daily life + walking + training, plus the user's personal calibration) -> goal calories -> gender-aware macros.
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
  /** Personal correction added to the formula's TDEE (from the calibration against the user's own weight trend). */
  tdeeAdjustmentKcal?: number;
}) {
  const { gender, weightKg, heightCm, age, dailyStepGoal, workoutDaysPerWeek, goal, tdeeAdjustmentKcal = 0 } = params;

  const bmr = mifflinStJeor(gender, weightKg, heightCm, age);
  const energy = estimateEnergyExpenditure({ bmr, weightKg, dailySteps: dailyStepGoal, trainingDaysPerWeek: workoutDaysPerWeek });
  const formulaTdee = energy.tdee;
  const tdee = formulaTdee + Math.round(tdeeAdjustmentKcal);

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
    formulaTdee,
    energy,
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
    tdeeAdjustmentKcal: metrics.tdeeAdjustmentKcal,
  });

  return {
    bmr: result.bmr,
    tdee: result.tdee,
    targetCalories: result.targetCalories,
    macros: { proteinG: result.proteinGrams, fatG: result.fatGrams, carbsG: result.carbGrams },
    calorieDeficitOrSurplus: result.targetCalories - result.tdee,
  };
}
