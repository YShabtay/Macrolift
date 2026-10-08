import type { StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getStepsForDate } from './stepsCalculations';
import { KCAL_PER_1000_STEPS, getEffectiveStepGoal } from './weeklyBalance';
import { addDaysIso } from './dateMath';
import { daysBetween, getWeekStart } from './weightCalculations';

export interface StepCredit {
  /** Calories the week's walking burned above (positive) or short of (negative) what the daily targets assume. This is the one number every calorie card uses. */
  netKcal: number;
  /** Steps walked above the goal on days that count, and steps short of it on completed days. */
  bonusSteps: number;
  shortfallSteps: number;
}

/**
 * The week's walking against the step goal the calorie target was built on, as calories, from Sunday through `asOf`. Days above the goal are credit, and
 * completed days below it are a debit: the target assumed that walking, so fewer steps means less burned. The day still in progress (`realToday` or later)
 * only counts when it is already above the goal, because its count is still growing. A day with no step entry has no data and is skipped, not counted as
 * zero. Overshoot coverage, the weekly budget and the daily recommendation all read this, so a change in the steps moves every one of them together.
 */
export function getStepCredit(params: {
  stepLogs: StepLog[];
  baseGoal: number;
  adjustment: WeeklyBalanceAdjustment | undefined;
  asOf: string;
  realToday?: string;
}): StepCredit {
  const { stepLogs, baseGoal, adjustment, asOf } = params;
  const realToday = params.realToday ?? asOf;
  const weekStart = getWeekStart(asOf);
  let bonusSteps = 0;
  let shortfallSteps = 0;
  for (let i = 0; i <= daysBetween(weekStart, asOf); i++) {
    const date = addDaysIso(weekStart, i);
    if (!stepLogs.some((s) => s.date === date)) continue;
    const diff = getStepsForDate(stepLogs, date) - getEffectiveStepGoal(baseGoal, adjustment, date, stepLogs);
    if (diff > 0) bonusSteps += diff;
    else if (diff < 0 && date < realToday) shortfallSteps += -diff;
  }
  bonusSteps = Math.round(bonusSteps);
  shortfallSteps = Math.round(shortfallSteps);
  return { netKcal: Math.round(((bonusSteps - shortfallSteps) * KCAL_PER_1000_STEPS) / 1000), bonusSteps, shortfallSteps };
}
