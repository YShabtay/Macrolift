import type { FoodEntry, MacroGrams, NutritionPlan, StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getStepsForDate } from './stepsCalculations';
import { daysBetween, formatIsoDate, getWeekEnd, getWeekStart, parseIsoDate } from './weightCalculations';
import { sumTotals } from './nutritionLog';

/** Rough walking energy cost used to convert calories to steps (~40 kcal per 1,000 steps). */
const KCAL_PER_1000_STEPS = 40;
/** Moderate walking cadence, used to turn steps into minutes. */
const STEPS_PER_MINUTE = 100;
/** Gentle limits: never trim more than this share of the daily target, never go below BMR / this floor. */
const MAX_REDUCTION_SHARE = 0.2;
const MIN_SAFE_TARGET_KCAL = 1200;
/** Sanity limits on extra walking: per day when spread out, and for a single-day catch-up. */
const MAX_STEP_BOOST = 5000;
const MAX_ONE_DAY_STEP_BOOST = 10000;

function addDays(date: string, days: number): string {
  const d = parseIsoDate(date);
  d.setDate(d.getDate() + days);
  return formatIsoDate(d);
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
  const steps = active?.steps;
  return steps && date >= steps.fromDate && (!steps.toDate || date <= steps.toDate) ? baseGoal + steps.boost : baseGoal;
}

/** What a rebalance already chosen will change tomorrow (shown today, when the adjustment hasn't started yet). */
export function getTomorrowAdjustments(
  plan: NutritionPlan,
  adjustment: WeeklyBalanceAdjustment | undefined,
  baseStepGoal: number,
  today: string,
): { calorieReductionKcal: number; stepBoost: number } {
  const tomorrow = addDays(today, 1);
  return {
    calorieReductionKcal: getDailyTargets(plan, adjustment, tomorrow).reductionKcal,
    stepBoost: getEffectiveStepGoal(baseStepGoal, adjustment, tomorrow) - baseStepGoal,
  };
}

export interface BonusStepDay {
  date: string;
  /** Steps walked above that day's goal. */
  steps: number;
}

/**
 * Days this week (Sunday through today) on which more steps were logged than that day's goal. Reads the saved per-day history, so a day
 * filled in or corrected afterwards counts immediately. These steps are already burned energy: they offset the day's calorie overshoot.
 */
export function getBonusStepDays(
  stepLogs: StepLog[],
  baseGoal: number,
  adjustment: WeeklyBalanceAdjustment | undefined,
  today: string,
): BonusStepDay[] {
  const weekStart = getWeekStart(today);
  const days: BonusStepDay[] = [];
  for (let i = 0; i <= daysBetween(weekStart, today); i++) {
    const date = addDays(weekStart, i);
    const bonus = getStepsForDate(stepLogs, date) - getEffectiveStepGoal(baseGoal, adjustment, date);
    if (bonus > 0) days.push({ date, steps: bonus });
  }
  return days;
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
  /** The one-time overshoot to make up for (total, not per day). */
  excessKcal: number;
  /** Steps walked today above today's goal - already burned, so they are credited against the overshoot. */
  extraStepsWalkedToday: number;
  /** Of those, the steps walked on earlier days of this week (e.g. yesterday, possibly entered afterwards). */
  extraStepsEarlier: number;
  /** True when the earlier bonus steps all come from yesterday alone. */
  earlierWasYesterday: boolean;
  /** The overshoot left to make up after crediting those steps (kcal). */
  netExcessKcal: number;
  /** Steps still needed after crediting today's extra steps; 0 means the overshoot is already fully covered. */
  netStepsNeeded: number;
  /** Days left in the week after today (Saturday = 0). The week is the scope: nothing carries into the next one. */
  daysRemaining: number;
  /** Energy equivalent of the overshoot in grams of fat (9 kcal/g) - for reassurance, not a literal prediction. */
  fatEquivalentG: number;
  /** Total steps that burn the overshoot (about 40 kcal per 1,000 steps). */
  totalStepsToBurn: number;
  /** Option A: the total surplus split evenly over the remaining days of the week. */
  taper: { available: boolean; perDayKcal: number; days: number; fromDate: string; capped: boolean };
  /** Option B1: all the extra walking on a single day - tomorrow, or today when the week ends today. */
  stepsOneDay: { steps: number; boost: number; date: string; isToday: boolean; minutes: number; capped: boolean };
  /** Option B2: the extra walking split over the remaining days (only meaningful with 2+ days left). */
  stepsSpread: { available: boolean; perDay: number; days: number; fromDate: string; minutes: number; capped: boolean };
}

/**
 * Splits a ONE-TIME overshoot of `excessKcal` into the rebalance options. The surplus is a single pool: spread over the remaining days
 * it is divided (190 kcal over 2 days = 95 per day), never repeated per day. With no days left, spreading options aren't available.
 */
export function buildRebalanceOptions(
  surplusKcal: number,
  plan: NutritionPlan,
  today: string,
  bonusDays: BonusStepDay[] = [],
): RebalanceOptions {
  // Steps walked above the daily goal (today or earlier this week) already burned part of the overshoot: take them off the debt first.
  const extraStepsToday = bonusDays.filter((d) => d.date === today).reduce((sum, d) => sum + d.steps, 0);
  const extraStepsEarlier = bonusDays.filter((d) => d.date !== today).reduce((sum, d) => sum + d.steps, 0);
  const extraSteps = Math.max(0, Math.round(extraStepsToday + extraStepsEarlier));
  const earlierWasYesterday = bonusDays.filter((d) => d.date !== today).every((d) => d.date === addDays(today, -1));
  const totalStepsRequired = Math.round((surplusKcal / KCAL_PER_1000_STEPS) * 1000);
  const netStepsNeeded = Math.max(0, totalStepsRequired - extraSteps);
  const excessKcal = Math.max(0, Math.round(surplusKcal - (extraSteps * KCAL_PER_1000_STEPS) / 1000));
  const weekEnd = getWeekEnd(today);
  const daysRemaining = Math.max(daysBetween(today, weekEnd), 0);
  const tomorrow = addDays(today, 1);

  // A: gentle daily cut over the remaining days, within a safe limit (a share of the target, never below BMR / the floor).
  let perDayKcal = 0;
  let capped = false;
  if (daysRemaining > 0 && excessKcal > 0) {
    const wanted = Math.max(Math.round(excessKcal / daysRemaining), 1);
    const maxPerDay = Math.max(
      Math.min(Math.round(plan.targetCalories * MAX_REDUCTION_SHARE), plan.targetCalories - Math.max(plan.bmr, MIN_SAFE_TARGET_KCAL)),
      0,
    );
    perDayKcal = Math.min(wanted, maxPerDay);
    capped = wanted > maxPerDay;
  }

  // B: the same energy as walking.
  const totalStepsToBurn = netStepsNeeded;
  const oneDaySteps = Math.min(totalStepsToBurn, MAX_ONE_DAY_STEP_BOOST);
  const spreadPerDay = daysRemaining > 0 ? Math.round(totalStepsToBurn / daysRemaining) : totalStepsToBurn;
  const spreadCapped = Math.min(spreadPerDay, MAX_STEP_BOOST);

  return {
    excessKcal: surplusKcal,
    extraStepsWalkedToday: extraSteps,
    extraStepsEarlier: Math.round(extraStepsEarlier),
    earlierWasYesterday,
    netExcessKcal: excessKcal,
    netStepsNeeded,
    daysRemaining,
    fatEquivalentG: Math.round(surplusKcal / 9),
    totalStepsToBurn,
    taper: { available: daysRemaining > 0 && perDayKcal > 0, perDayKcal, days: daysRemaining, fromDate: tomorrow, capped },
    stepsOneDay: {
      steps: oneDaySteps,
      // Tomorrow's goal rises by exactly the net steps. On the last day of the week the bonus steps walked *today* are already in today's
      // count, so the goal rises by the net steps plus those; bonus from earlier days is not in today's count and is not added back.
      boost: netStepsNeeded === 0 ? 0 : daysRemaining > 0 ? oneDaySteps : Math.min(netStepsNeeded + Math.round(extraStepsToday), MAX_ONE_DAY_STEP_BOOST),
      date: daysRemaining > 0 ? tomorrow : today,
      isToday: daysRemaining === 0,
      minutes: Math.round(oneDaySteps / STEPS_PER_MINUTE),
      capped: totalStepsToBurn > MAX_ONE_DAY_STEP_BOOST,
    },
    stepsSpread: {
      available: daysRemaining >= 2,
      perDay: spreadCapped,
      days: daysRemaining,
      fromDate: tomorrow,
      minutes: Math.round(spreadCapped / STEPS_PER_MINUTE),
      capped: spreadPerDay > MAX_STEP_BOOST,
    },
  };
}
