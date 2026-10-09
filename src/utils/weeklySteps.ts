import type { AppState, FoodEntry, NutritionPlan, StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getStepsForDate } from './stepsCalculations';
import { getActiveAdjustment, getDailyTargets } from './weeklyBalance';
import { sumTotals } from './nutritionLog';
import { addDaysIso } from './dateMath';
import { daysBetween, getWeekEnd, getWeekStart } from './weightCalculations';

export type StepGoalMode = 'weekly' | 'daily';
export type StepMode = 'balance_steps' | 'add_calories';

/** Calories burned per step for a 70 kg person; scaled by body weight. */
export const KCAL_PER_STEP_AT_70KG = 0.04;

export function getStepMode(state: Pick<AppState, 'stepMode'>): StepMode {
  return state.stepMode ?? 'balance_steps';
}

/** The extra steps in the week's total that a calorie rebalance asked for (boost per day x the days it covers); 0 when there is none or it is another week's. */
export function getStepBoostExtraSteps(adjustment: WeeklyBalanceAdjustment | undefined, date: string): number {
  const stepsBoost = getActiveAdjustment(adjustment, date)?.steps;
  if (!stepsBoost) return 0;
  const boostDays = Math.max(stepsBoost.days ?? daysBetween(stepsBoost.fromDate, stepsBoost.toDate ?? getWeekEnd(stepsBoost.fromDate)) + 1, 1);
  return stepsBoost.boost * boostDays;
}

export interface WeeklyStepsPlan {
  weekStart: string;
  /** The goal per day, as set. */
  targetDailySteps: number;
  /** The week's total goal: 7 x the daily goal, plus any extra walking a calorie rebalance asked for. */
  weeklyTarget: number;
  /** Days of the week before the viewed day (0 on Sunday). */
  daysBefore: number;
  /** Days left in the week counting the viewed day itself, through Saturday (7 on Sunday, 1 on Saturday). Never below 1. */
  daysRemaining: number;
  /** Steps walked from Sunday through the day before the viewed day. A day with no entry counts as 0 steps. */
  walkedBeforeToday: number;
  /** Average steps per day over the days before the viewed day; null on Sunday, when there is none yet. */
  averageBefore: number | null;
  /** Steps walked on the viewed day so far. */
  stepsOnDay: number;
  /** What the week still needs, counted from the start of the viewed day (0 once the week's target is reached). */
  stepsNeeded: number;
  /** What the viewed day and each day after it needs to walk to finish on the weekly goal. Walking above the average before lowers it, a short day raises it. */
  targetForTodayAndRemaining: number;
  /** What is still left of that target today (0 once reached); updates as the day's steps are entered. */
  leftToday: number;
}

/**
 * The weekly step plan, Sunday to Saturday. The user sets a daily goal (4,500 -> 31,500 for the week). What was walked on the days BEFORE the viewed day
 * is taken off the week's total and the rest is shared over the viewed day and the days after it, so walking above the average so far lowers the goal,
 * and a short day raises it. The viewed day counts as a day still to walk until it is over, so on a morning with nothing entered yet the number is a
 * sensible daily target, and it stays the same while the day's steps are entered (what is left of it is `leftToday`). A day with no entry counts as 0
 * steps. Computed live from the history, so editing an earlier day updates it at once. `extraSteps` is walking a calorie rebalance asked for, added to the
 * week's total.
 */
export function getWeeklyStepsPlan(targetDailySteps: number, stepLogs: StepLog[], date: string, extraSteps = 0): WeeklyStepsPlan {
  const weekStart = getWeekStart(date);
  const daysBefore = daysBetween(weekStart, date);
  const daysRemaining = Math.max(7 - daysBefore, 1);
  const weeklyTarget = targetDailySteps * 7 + extraSteps;

  const walkedBeforeToday = stepLogs.filter((s) => s.date >= weekStart && s.date < date).reduce((sum, s) => sum + s.steps, 0);
  const stepsOnDay = getStepsForDate(stepLogs, date);
  const stepsNeeded = Math.max(0, weeklyTarget - walkedBeforeToday);
  const targetForTodayAndRemaining = Math.round(stepsNeeded / daysRemaining);

  return {
    weekStart,
    targetDailySteps,
    weeklyTarget,
    daysBefore,
    daysRemaining,
    walkedBeforeToday,
    averageBefore: daysBefore > 0 ? Math.round(walkedBeforeToday / daysBefore) : null,
    stepsOnDay,
    stepsNeeded,
    targetForTodayAndRemaining,
    leftToday: Math.max(0, targetForTodayAndRemaining - stepsOnDay),
  };
}

/** Calories to add to a day's budget for the steps walked above the daily goal (0 when at or under it). Used in the 'add_calories' mode. */
export function stepBonusKcal(steps: number, targetDailySteps: number, weightKg: number): number {
  const surplus = steps - targetDailySteps;
  return surplus > 0 ? Math.round(surplus * (weightKg / 70) * KCAL_PER_STEP_AT_70KG) : 0;
}

/**
 * Calories a finished day's steps add (above the goal) or take away (below it), for a day that has a step entry. The calorie target assumes the goal is
 * walked every day, so a short day really burned less and is netted against the days that went over before anything becomes food. Days with no entry
 * are not counted: a day that was simply not logged is not a day not walked.
 */
export function stepNetKcal(steps: number, hasEntry: boolean, targetDailySteps: number, weightKg: number): number {
  if (!hasEntry) return 0;
  const diff = steps - targetDailySteps;
  return diff >= 0 ? stepBonusKcal(steps, targetDailySteps, weightKg) : -Math.round(-diff * (weightKg / 70) * KCAL_PER_STEP_AT_70KG);
}

export interface StepCalorieBank {
  /** What to add to each day's target (date -> kcal): the part of the bank that day actually ate, and for today everything available. */
  allowance: Record<string, number>;
  /** What came into today from earlier days of the week, unspent, after the days that fell short are taken off (can be negative). */
  carriedIntoToday: number;
  /** Calories earned from today's steps so far. */
  bonusToday: number;
  /** Today's whole allowance: what is carried in plus what today's steps earned (never below 0). */
  availableToday: number;
}

/**
 * The week's calorie bank in the 'add_calories' mode. Each day's steps above the goal earn calories; calories not eaten that day are not lost at midnight,
 * they carry to the next days of the same week until they are used up by eating above the base target (or the week ends on Sunday). A day that fell short of
 * the goal takes calories off the bank first (down to a debt that later days must cover), so only the net walking becomes food. Today's own steps only
 * add: the day is not over, so a low count so far is not a shortfall yet.
 *
 * For a day before today: it spent min(what was available, what it ate above its base target), and that spent part is what is added to its target (so
 * eaten minus target stays honest and the same calories are never in two days' targets). For today: its target includes everything available (carried in
 * plus today's steps so far). The base target of a day is its target without any step calories, so a lowered target from a rebalance still applies.
 */
export function getStepCalorieBank(params: {
  baseAdjustment: WeeklyBalanceAdjustment | undefined;
  plan: NutritionPlan;
  stepLogs: StepLog[];
  foodLog: FoodEntry[];
  targetDailySteps: number;
  weightKg: number;
  today: string;
}): StepCalorieBank {
  const { baseAdjustment, plan, stepLogs, foodLog, targetDailySteps, weightKg, today } = params;
  const weekStart = getWeekStart(today);
  const allowance: Record<string, number> = {};
  let bank = 0;
  let bonusToday = 0;
  let carriedIntoToday = 0;

  for (let i = 0; i <= daysBetween(weekStart, today); i++) {
    const day = addDaysIso(weekStart, i);
    const daySteps = getStepsForDate(stepLogs, day);
    if (day === today) {
      const bonus = stepBonusKcal(daySteps, targetDailySteps, weightKg);
      const available = Math.max(0, bank + bonus);
      carriedIntoToday = bank;
      bonusToday = bonus;
      if (available > 0) allowance[day] = available;
      return { allowance, carriedIntoToday, bonusToday, availableToday: available };
    }
    const available = bank + stepNetKcal(daySteps, stepLogs.some((l) => l.date === day), targetDailySteps, weightKg);
    const base = getDailyTargets(plan, baseAdjustment, day).calories;
    const eaten = sumTotals(foodLog.filter((f) => f.date === day)).calories;
    const used = Math.min(Math.max(available, 0), Math.max(0, Math.round(eaten - base)));
    if (used > 0) allowance[day] = used;
    bank = available - used;
  }
  return { allowance, carriedIntoToday, bonusToday, availableToday: 0 };
}

/**
 * The adjustment every calorie screen should read for the current week, with the step mode applied.
 * - 'add_calories': the calorie bank above (each day's steps above the goal become calories on the target, unspent calories carrying to the next days of
 *   the week), and a "walk more" rebalance is dropped: the goal for the coming days does not change in this mode.
 * - 'balance_steps': the calorie budget is untouched by steps.
 * Nothing is stored: it is derived from the step and food history on every read, so editing a day changes the numbers at once.
 */
export function withStepMode(
  adjustment: WeeklyBalanceAdjustment | undefined,
  params: { mode: StepMode; stepLogs: StepLog[]; foodLog: FoodEntry[]; plan: NutritionPlan; targetDailySteps: number; weightKg: number; today: string },
): WeeklyBalanceAdjustment | undefined {
  const { mode, today } = params;
  const weekStart = getWeekStart(today);
  const current = getActiveAdjustment(adjustment, today);
  // Whatever step allowance was saved by an older version is never trusted: the only allowance is the one derived below.
  const { stepAllowance: _saved, ...kept } = current ?? { weekStart };
  if (mode === 'balance_steps') return current ? kept : undefined;

  const { steps: _walkMore, ...withoutWalkMore } = kept;
  const { allowance } = getStepCalorieBank({ baseAdjustment: withoutWalkMore, plan: params.plan, stepLogs: params.stepLogs, foodLog: params.foodLog, targetDailySteps: params.targetDailySteps, weightKg: params.weightKg, today });
  const hasBonus = Object.keys(allowance).length > 0;
  return hasBonus || current ? { ...withoutWalkMore, ...(hasBonus ? { stepAllowance: allowance } : {}) } : undefined;
}
