import type { StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getStepsForDate } from './stepsCalculations';
import { getActiveAdjustment } from './weeklyBalance';
import { daysBetween, formatIsoDate, getWeekEnd, getWeekStart, parseIsoDate } from './weightCalculations';

export type StepGoalMode = 'weekly' | 'daily';

/** Today's pace is never asked to exceed this multiple of the average goal, so one lazy day can't produce an absurd target. */
const MAX_PACE_MULTIPLE = 1.5;

function addDays(date: string, days: number): string {
  const d = parseIsoDate(date);
  d.setDate(d.getDate() + days);
  return formatIsoDate(d);
}

export interface WeeklyStepsPlan {
  weekStart: string;
  /** The week's total goal: 7 x the daily average, plus any extra walking a calorie rebalance asked for. */
  weeklyTarget: number;
  /** Steps walked on the days of the week before the viewed date. */
  walkedBefore: number;
  /** Steps walked on the viewed date itself. */
  walkedOnDate: number;
  /** Days left in the week, counting the viewed date. */
  daysLeft: number;
  /** What's still needed from the viewed date to week's end (0 once the week's target is already covered). */
  remainingFromDate: number;
  /** The suggested goal for the viewed date: the remaining steps spread evenly over the days left. */
  paceToday: number;
  /** True when the pace was capped because covering the whole gap in the days left would be unrealistic. */
  capped: boolean;
  /** Steps ahead (+) or behind (-) of the plain daily average over the days before the viewed date. */
  balanceBefore: number;
  /** Whole-week steps so far (through the viewed date, or the whole week for a past week). */
  walkedThisWeek: number;
  /** Average steps per day over the days counted so far this week. */
  averageSoFar: number;
}

/**
 * The weekly-average step goal. The user sets an average per day (e.g. 8,000 -> 56,000 for the week); each day's goal is whatever
 * remains of the week's total divided by the days left, so steps above the average on one day lower the goal of the next days, and
 * a short day is spread over the rest of the week. Computed live from the history, so editing an earlier day updates it at once.
 */
export function getWeeklyStepsPlan(
  baseGoal: number,
  adjustment: WeeklyBalanceAdjustment | undefined,
  stepLogs: StepLog[],
  date: string,
): WeeklyStepsPlan {
  const weekStart = getWeekStart(date);
  const dayIndex = daysBetween(weekStart, date); // 0 = Sunday ... 6 = Saturday
  const daysLeft = 7 - dayIndex;

  // A calorie rebalance's walking boost is part of the week's total (boost per day x the days it covers).
  const stepsBoost = getActiveAdjustment(adjustment, date)?.steps;
  const boostDays = stepsBoost ? Math.max(stepsBoost.days ?? daysBetween(stepsBoost.fromDate, stepsBoost.toDate ?? getWeekEnd(stepsBoost.fromDate)) + 1, 1) : 0;
  const extra = stepsBoost ? stepsBoost.boost * boostDays : 0;
  const weeklyTarget = baseGoal * 7 + extra;

  let walkedBefore = 0;
  for (let i = 0; i < dayIndex; i++) walkedBefore += getStepsForDate(stepLogs, addDays(weekStart, i));
  const walkedOnDate = getStepsForDate(stepLogs, date);

  const remainingFromDate = Math.max(weeklyTarget - walkedBefore, 0);
  const rawPace = Math.ceil(remainingFromDate / daysLeft);
  const maxPace = Math.round(baseGoal * MAX_PACE_MULTIPLE);
  const paceToday = Math.min(rawPace, Math.max(maxPace, baseGoal));

  const walkedThisWeek = walkedBefore + walkedOnDate;
  return {
    weekStart,
    weeklyTarget,
    walkedBefore,
    walkedOnDate,
    daysLeft,
    remainingFromDate,
    paceToday,
    capped: rawPace > paceToday,
    balanceBefore: walkedBefore - baseGoal * dayIndex,
    walkedThisWeek,
    averageSoFar: Math.round(walkedThisWeek / (dayIndex + 1)),
  };
}
