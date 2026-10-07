import type { FoodEntry, NutritionPlan, StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getEntriesForDate, sumTotals } from './nutritionLog';
import { KCAL_PER_1000_STEPS, getBonusStepDays, getDailyTargets, getWeeklyEnergyBalance } from './weeklyBalance';

export interface OvershootCoverage {
  /** Calories over today's target; 0 when today is at or under it. */
  overshootKcal: number;
  /** True when the overshoot needs no action: the week as a whole is still in balance. */
  isCovered: boolean;
  /** Steps walked above the daily goal this week (today and earlier days), and the calories those already burned. */
  bonusSteps: number;
  stepsKcal: number;
  /** The week so far (days with logged food) is already at or under its cumulative target, with no help from the extra steps. */
  coveredByWeek: boolean;
  /** The week so far is over its cumulative target, but the extra steps bring it back to balance. */
  coveredBySteps: boolean;
  /** Eaten minus target for the week so far, before any step credit. */
  weekBalanceKcal: number;
  /** When covered: how many more kcal can be eaten today and the week still stays in balance. 0 otherwise. */
  roomKcal: number;
}

/**
 * Whether today's calorie overshoot is already made up for, so it should be shown as covered instead of as a problem to fix, and how much room
 * is left. The body answers to the week, not to one day, so the test is the week: the cumulative eaten-minus-target over the days logged so far,
 * less the calories the extra steps already burned, is at or below zero. The steps count once against the whole week - not once per day - so
 * they cannot cover today's overshoot if earlier days' overshoot already uses them up.
 */
export function getOvershootCoverage(params: {
  foodLog: FoodEntry[];
  plan: NutritionPlan;
  adjustment: WeeklyBalanceAdjustment | undefined;
  stepLogs: StepLog[];
  baseStepGoal: number;
  today: string;
}): OvershootCoverage {
  const { foodLog, plan, adjustment, stepLogs, baseStepGoal, today } = params;
  const eaten = sumTotals(getEntriesForDate(foodLog, today)).calories;
  const target = getDailyTargets(plan, adjustment, today).calories;
  const overshootKcal = Math.max(Math.round(eaten - target), 0);

  const bonusSteps = Math.round(getBonusStepDays(stepLogs, baseStepGoal, adjustment, today).reduce((sum, d) => sum + d.steps, 0));
  const stepsKcal = Math.round((bonusSteps * KCAL_PER_1000_STEPS) / 1000);
  const weekBalanceKcal = getWeeklyEnergyBalance(foodLog, plan, adjustment, today).balanceKcal;
  const netWeek = weekBalanceKcal - stepsKcal;

  const isCovered = overshootKcal > 0 && netWeek <= 0;
  const coveredByWeek = isCovered && weekBalanceKcal <= 0;
  const coveredBySteps = isCovered && weekBalanceKcal > 0;
  const roomKcal = isCovered ? Math.round(-netWeek) : 0;

  return { overshootKcal, isCovered, bonusSteps, stepsKcal, coveredByWeek, coveredBySteps, weekBalanceKcal, roomKcal };
}

/** One line saying what covered the overshoot. */
export function describeCoverage(c: OvershootCoverage): string {
  if (c.coveredBySteps) return `${c.bonusSteps.toLocaleString('he-IL')} צעדי בונוס שהלכת השבוע (כ-${c.stepsKcal} קק״ל) מאזנים את העודף של השבוע`;
  return 'מאזן השבוע עד כה עדיין מתחת ליעד המצטבר, אז אין צורך באיזון';
}

/** How much more can be eaten while the week stays in balance (shown when the overshoot is covered); empty when there is no real room. */
export function describeRoom(c: OvershootCoverage): string {
  return c.isCovered && c.roomKcal >= 10 ? `עוד אפשר לאכול כ-${c.roomKcal.toLocaleString('he-IL')} קק״ל ולהישאר מאוזן השבוע.` : '';
}
