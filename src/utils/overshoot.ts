import type { FoodEntry, NutritionPlan, StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getEntriesForDate, sumTotals } from './nutritionLog';
import { KCAL_PER_1000_STEPS, getBonusStepDays, getDailyTargets, getWeeklyEnergyBalance } from './weeklyBalance';

export interface OvershootCoverage {
  /** Calories over today's target; 0 when today is at or under it. */
  overshootKcal: number;
  /** True when the overshoot needs no action: something already covers it. */
  isCovered: boolean;
  /** Steps walked above the daily goal this week (today and earlier days), and the calories those already burned. */
  bonusSteps: number;
  stepsKcal: number;
  /** The bonus steps alone burn at least the overshoot. */
  coveredBySteps: boolean;
  /** The week so far (days with logged food), after crediting those steps, is at or under its cumulative target. */
  coveredByWeek: boolean;
  /** Eaten minus target for the week so far, before any step credit. */
  weekBalanceKcal: number;
}

/**
 * Whether today's calorie overshoot is already made up for, so it should be shown as covered instead of as a problem to fix. It is covered when
 * the extra steps walked this week burned at least the overshoot, or when the week as a whole - counting the days logged so far and crediting those
 * extra steps - is still within its cumulative target (the body answers to the weekly average, not to one day).
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

  const coveredBySteps = overshootKcal > 0 && stepsKcal >= overshootKcal;
  const coveredByWeek = overshootKcal > 0 && weekBalanceKcal - stepsKcal <= 0;
  return { overshootKcal, isCovered: coveredBySteps || coveredByWeek, bonusSteps, stepsKcal, coveredBySteps, coveredByWeek, weekBalanceKcal };
}

/** One line saying what covered the overshoot. */
export function describeCoverage(c: OvershootCoverage): string {
  if (c.coveredBySteps && c.coveredByWeek) return `${c.bonusSteps.toLocaleString('he-IL')} צעדי בונוס מהשבוע, וגם מאזן השבוע כולו, מכסים אותה`;
  if (c.coveredBySteps) return `${c.bonusSteps.toLocaleString('he-IL')} צעדי בונוס שהלכת השבוע (כ-${c.stepsKcal} קק״ל) כיסו אותה`;
  if (c.stepsKcal > 0) return `מאזן השבוע, יחד עם צעדי הבונוס שהלכת (כ-${c.stepsKcal} קק״ל), מכסה אותה`;
  return 'מאזן השבוע עד כה עדיין מתחת ליעד המצטבר, אז אין צורך באיזון';
}
