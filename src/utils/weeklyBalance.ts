import type { FoodEntry, MacroGrams, NutritionPlan, WeeklyBalanceAdjustment } from '../types/fitness';
import { daysBetween, formatIsoDate, getWeekEnd, getWeekStart, parseIsoDate } from './weightCalculations';
import { sumTotals } from './nutritionLog';

/** Rough walking energy cost used to convert calories to steps (~40 kcal per 1,000 steps). */
const KCAL_PER_1000_STEPS = 40;
/** Moderate walking cadence, used to turn steps into minutes. */
const STEPS_PER_MINUTE = 100;
/** Gentle limits: never trim more than this share of the daily target, never go below BMR / this floor. */
const MAX_REDUCTION_SHARE = 0.2;
const MIN_SAFE_TARGET_KCAL = 1200;
const MAX_STEP_BOOST = 5000;
const MIN_STEP_BOOST = 500;

function addDays(date: string, days: number): string {
  const d = parseIsoDate(date);
  d.setDate(d.getDate() + days);
  return formatIsoDate(d);
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** The adjustment, only if it belongs to the week containing `date` - last week's adjustment is simply ignored. */
export function getActiveAdjustment(adjustment: WeeklyBalanceAdjustment | undefined, date: string): WeeklyBalanceAdjustment | undefined {
  return adjustment && adjustment.weekStart === getWeekStart(date) ? adjustment : undefined;
}

export interface DailyTargets {
  calories: number;
  macros: MacroGrams;
  /** How many kcal the temporary rebalance took off this day's base target (0 normally). */
  reductionKcal: number;
}

/**
 * The calorie/macro target for one date. The base plan unless a rebalance reduction covers that date (same week, on or after its
 * start date); the cut comes out of fat and carbs in proportion to their calories, protein stays put.
 */
export function getDailyTargets(plan: NutritionPlan, adjustment: WeeklyBalanceAdjustment | undefined, date: string): DailyTargets {
  const active = getActiveAdjustment(adjustment, date);
  const reduction = active?.calorie && date >= active.calorie.fromDate ? active.calorie.reductionKcal : 0;
  if (reduction <= 0) return { calories: plan.targetCalories, macros: plan.macros, reductionKcal: 0 };

  const fatKcal = plan.macros.fatG * 9;
  const carbKcal = plan.macros.carbsG * 4;
  const flexKcal = fatKcal + carbKcal;
  const fatShare = flexKcal > 0 ? fatKcal / flexKcal : 0.5;
  return {
    calories: plan.targetCalories - reduction,
    macros: {
      proteinG: plan.macros.proteinG,
      fatG: Math.max(Math.round(plan.macros.fatG - (reduction * fatShare) / 9), 0),
      carbsG: Math.max(Math.round(plan.macros.carbsG - (reduction * (1 - fatShare)) / 4), 0),
    },
    reductionKcal: reduction,
  };
}

/** The daily step goal for a date: the base goal plus any rebalance boost that covers it. */
export function getEffectiveStepGoal(baseGoal: number, adjustment: WeeklyBalanceAdjustment | undefined, date: string): number {
  const active = getActiveAdjustment(adjustment, date);
  return active?.steps && date >= active.steps.fromDate ? baseGoal + active.steps.boost : baseGoal;
}

export interface WeeklyEnergyBalance {
  /** Days from Sunday through today on which something was logged (today always counts). */
  daysCounted: number;
  eatenKcal: number;
  targetKcal: number;
  /** Positive = above the target so far this week. */
  balanceKcal: number;
}

/**
 * Cumulative calories eaten vs the cumulative target for the current week (Sunday to today). Only days with logged food count
 * (plus today), so days the user simply didn't track don't masquerade as a big deficit.
 */
export function getWeeklyEnergyBalance(
  foodLog: FoodEntry[],
  plan: NutritionPlan,
  adjustment: WeeklyBalanceAdjustment | undefined,
  today: string,
): WeeklyEnergyBalance {
  const weekStart = getWeekStart(today);
  const daysElapsed = daysBetween(weekStart, today) + 1;
  let eatenKcal = 0;
  let targetKcal = 0;
  let daysCounted = 0;

  for (let i = 0; i < daysElapsed; i++) {
    const date = addDays(weekStart, i);
    const entries = foodLog.filter((f) => f.date === date);
    if (entries.length === 0 && date !== today) continue;
    daysCounted++;
    eatenKcal += sumTotals(entries).calories;
    targetKcal += getDailyTargets(plan, adjustment, date).calories;
  }

  return { daysCounted, eatenKcal: Math.round(eatenKcal), targetKcal: Math.round(targetKcal), balanceKcal: Math.round(eatenKcal - targetKcal) };
}

export interface RebalanceOptions {
  excessKcal: number;
  /** Days left in the week after today (Saturday = 0). */
  daysRemaining: number;
  /** Energy equivalent of the overshoot in grams of fat (9 kcal/g) - for reassurance, not a literal prediction. */
  fatEquivalentG: number;
  taper: { available: boolean; perDayKcal: number; fromDate: string; capped: boolean };
  steps: { perDay: number; minutes: number; days: number; fromDate: string; capped: boolean };
}

/** Works out the gentle daily taper and the walking equivalent for an overshoot of `excessKcal` on `today`. */
export function buildRebalanceOptions(excessKcal: number, plan: NutritionPlan, today: string): RebalanceOptions {
  const weekEnd = getWeekEnd(today);
  const daysRemaining = Math.max(daysBetween(today, weekEnd), 0);
  const tomorrow = addDays(today, 1);

  // Option 1: spread the overshoot over the days still ahead, within a gentle, safe limit.
  let perDayKcal = 0;
  let capped = false;
  if (daysRemaining > 0) {
    const wanted = roundTo(excessKcal / daysRemaining, 5);
    const maxPerDay = Math.max(
      Math.min(roundTo(plan.targetCalories * MAX_REDUCTION_SHARE, 5), plan.targetCalories - Math.max(plan.bmr, MIN_SAFE_TARGET_KCAL)),
      0,
    );
    perDayKcal = Math.min(Math.max(wanted, 5), maxPerDay);
    capped = wanted > maxPerDay;
  }

  // Option 2: the same energy as extra walking, starting today (walking today offsets today's surplus too).
  const stepDays = daysRemaining + 1;
  const totalSteps = (excessKcal / KCAL_PER_1000_STEPS) * 1000;
  const wantedSteps = roundTo(totalSteps / stepDays, 100);
  const perDaySteps = Math.min(Math.max(wantedSteps, MIN_STEP_BOOST), MAX_STEP_BOOST);

  return {
    excessKcal,
    daysRemaining,
    fatEquivalentG: Math.round(excessKcal / 9),
    taper: { available: daysRemaining > 0 && perDayKcal > 0, perDayKcal, fromDate: tomorrow, capped },
    steps: {
      perDay: perDaySteps,
      minutes: Math.round(perDaySteps / STEPS_PER_MINUTE),
      days: stepDays,
      fromDate: today,
      capped: wantedSteps > MAX_STEP_BOOST,
    },
  };
}
