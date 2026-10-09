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
  /**
   * What the viewed date alone would have to walk so that every later day can be the plain average: the whole surplus taken as a lighter day
   * (down to 0) or the whole gap made up in one day. `paceToday` is the same thing spread evenly over the days left.
   */
  takeAllToday: number;
  /** Steps ahead (+) or behind (-) of the plain daily average over the days before the viewed date. Days with no entry count as on target. */
  balanceBefore: number;
  /** Days before the viewed date with no step entry: treated as exactly on target, like in the calorie accounting, not as zero steps. */
  unloggedDaysBefore: number;
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

  // A day with no entry is unknown, not zero: it counts as exactly on target, the same rule the calorie side uses, so the two never disagree.
  let walkedBefore = 0;
  let unloggedDaysBefore = 0;
  for (let i = 0; i < dayIndex; i++) {
    const day = addDays(weekStart, i);
    if (stepLogs.some((s) => s.date === day)) walkedBefore += getStepsForDate(stepLogs, day);
    else {
      walkedBefore += baseGoal;
      unloggedDaysBefore += 1;
    }
  }
  const walkedOnDate = getStepsForDate(stepLogs, date);

  const remainingFromDate = Math.max(weeklyTarget - walkedBefore, 0);
  const rawPace = Math.ceil(remainingFromDate / daysLeft);
  const maxPace = Math.round(baseGoal * MAX_PACE_MULTIPLE);
  const paceToday = Math.min(rawPace, Math.max(maxPace, baseGoal));

  const walkedThisWeek = walkedBefore - baseGoal * unloggedDaysBefore + walkedOnDate;
  return {
    weekStart,
    weeklyTarget,
    walkedBefore,
    walkedOnDate,
    daysLeft,
    remainingFromDate,
    paceToday,
    takeAllToday: Math.max(0, remainingFromDate - baseGoal * (daysLeft - 1)),
    unloggedDaysBefore,
    capped: rawPace > paceToday,
    balanceBefore: walkedBefore - baseGoal * dayIndex,
    walkedThisWeek,
    averageSoFar: Math.round(walkedThisWeek / Math.max(dayIndex + 1 - unloggedDaysBefore, 1)),
  };
}
