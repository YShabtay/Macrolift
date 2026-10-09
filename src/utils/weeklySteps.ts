import type { AppState, StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getStepsForDate } from './stepsCalculations';
import { getActiveAdjustment } from './weeklyBalance';
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
  /** Days of the week from Sunday up to and including the viewed day (1-7). */
  daysPassed: number;
  /** Days after the viewed day (at least 1, so the share below never divides by zero; on Saturday it is the rest of the week's total on one day). */
  daysRemaining: number;
  /** Steps actually walked from Sunday through the viewed day. A day with no entry counts as 0 steps. */
  totalStepsWalked: number;
  /** Steps walked on the viewed day itself. */
  stepsOnDay: number;
  /** Average steps per day since Sunday (through the viewed day). */
  averageSoFar: number;
  /** What is still missing from the week's total (0 once it is reached). */
  remainingNeeded: number;
  /** What each of the days after the viewed day needs to walk to finish on the weekly goal. Walking above the average so far lowers it. */
  adjustedDailyTarget: number;
}

/**
 * The weekly step plan, Sunday to Saturday. The user sets a daily goal (4,500 -> 31,500 for the week); what has been walked so far is taken off the
 * week's total and the rest is shared over the days that are left, so walking above the average so far lowers the goal of the coming days, and a short
 * day raises it. A day with no entry counts as 0 steps. Computed live from the history, so editing an earlier day updates it at once.
 * `extraSteps` is walking a calorie rebalance asked for, added to the week's total.
 */
export function getWeeklyStepsPlan(targetDailySteps: number, stepLogs: StepLog[], date: string, extraSteps = 0): WeeklyStepsPlan {
  const weekStart = getWeekStart(date);
  const daysPassed = daysBetween(weekStart, date) + 1;
  const daysRemaining = Math.max(7 - daysPassed, 1);
  const weeklyTarget = targetDailySteps * 7 + extraSteps;

  const stepsOnDay = getStepsForDate(stepLogs, date);
  const totalStepsWalked = stepLogs.filter((s) => s.date >= weekStart && s.date <= date).reduce((sum, s) => sum + s.steps, 0);
  const remainingNeeded = Math.max(0, weeklyTarget - totalStepsWalked);

  return {
    weekStart,
    targetDailySteps,
    weeklyTarget,
    daysPassed,
    daysRemaining,
    totalStepsWalked,
    stepsOnDay,
    averageSoFar: Math.round(totalStepsWalked / daysPassed),
    remainingNeeded,
    adjustedDailyTarget: Math.round(remainingNeeded / daysRemaining),
  };
}

/** Calories to add to a day's budget for the steps walked above the daily goal (0 when at or under it). Used in the 'add_calories' mode. */
export function stepBonusKcal(steps: number, targetDailySteps: number, weightKg: number): number {
  const surplus = steps - targetDailySteps;
  return surplus > 0 ? Math.round(surplus * (weightKg / 70) * KCAL_PER_STEP_AT_70KG) : 0;
}

/**
 * The adjustment every calorie screen should read for the current week, with the step mode applied.
 * - 'add_calories': each day's steps above the goal become calories on that same day's target (carried in `stepAllowance`, which the daily-target
 *   function adds), and a "walk more" rebalance is dropped: the goal for the coming days does not change in this mode.
 * - 'balance_steps': the calorie budget is untouched by steps.
 * Nothing is stored: it is derived from the step history on every read, so editing a day's steps changes that day's calories at once.
 */
export function withStepMode(
  adjustment: WeeklyBalanceAdjustment | undefined,
  params: { mode: StepMode; stepLogs: StepLog[]; targetDailySteps: number; weightKg: number; today: string },
): WeeklyBalanceAdjustment | undefined {
  const { mode, stepLogs, targetDailySteps, weightKg, today } = params;
  const weekStart = getWeekStart(today);
  const current = getActiveAdjustment(adjustment, today);
  // Whatever step allowance was saved by an older version is never trusted: the only allowance is the one derived from the steps below.
  const { stepAllowance: _saved, ...kept } = current ?? { weekStart };
  if (mode === 'balance_steps') return current ? kept : undefined;

  const { steps: _walkMore, ...withoutWalkMore } = kept;
  const bonus: Record<string, number> = {};
  for (const log of stepLogs) {
    if (log.date < weekStart || log.date > today) continue;
    const kcal = stepBonusKcal(log.steps, targetDailySteps, weightKg);
    if (kcal > 0) bonus[log.date] = kcal;
  }
  const hasBonus = Object.keys(bonus).length > 0;
  return hasBonus || current ? { ...withoutWalkMore, ...(hasBonus ? { stepAllowance: bonus } : {}) } : undefined;
}
