import type { FoodEntry, NutritionPlan, StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getEntriesForDate, sumTotals } from './nutritionLog';
import { getDailyTargets, getWeeklyEnergyBalance } from './weeklyBalance';
import { getStepCredit } from './stepCredit';

/** The calorie estimates are approximate (a few percent on steps, ~10% on the formula), so a week this close to its target counts as in balance. */
export const COVERAGE_TOLERANCE_KCAL = 50;

export interface OvershootCoverage {
  /** Calories over today's target; 0 when today is at or under it. */
  overshootKcal: number;
  /** True when the overshoot needs no action: the week as a whole is still in balance. */
  isCovered: boolean;
  /** The week's walking against the step goal: steps above it, steps short of it on completed days, and the net calories (negative when short). */
  bonusSteps: number;
  shortfallSteps: number;
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
  /** The day being judged; the week is counted up to it. */
  today: string;
  /** The real current date, when `today` is a past day being looked at: the days before it are finished, so their missing steps count. */
  realToday?: string;
}): OvershootCoverage {
  const { foodLog, plan, adjustment, stepLogs, baseStepGoal, today, realToday } = params;
  const eaten = sumTotals(getEntriesForDate(foodLog, today)).calories;
  const target = getDailyTargets(plan, adjustment, today).calories;
  const overshootKcal = Math.max(Math.round(eaten - target), 0);

  const { bonusSteps, shortfallSteps, netKcal: stepsKcal } = getStepCredit({ stepLogs, baseGoal: baseStepGoal, adjustment, asOf: today, realToday });
  const weekBalanceKcal = getWeeklyEnergyBalance(foodLog, plan, adjustment, today).balanceKcal;
  const netWeek = weekBalanceKcal - stepsKcal;

  const isCovered = overshootKcal > 0 && netWeek <= COVERAGE_TOLERANCE_KCAL;
  const coveredByWeek = isCovered && weekBalanceKcal <= 0;
  const coveredBySteps = isCovered && weekBalanceKcal > 0 && stepsKcal > 0;
  const roomKcal = isCovered ? Math.max(Math.round(-netWeek), 0) : 0;

  return { overshootKcal, isCovered, bonusSteps, shortfallSteps, stepsKcal, coveredByWeek, coveredBySteps, weekBalanceKcal, roomKcal };
}

/**
 * What is really left to make up when today's overshoot is not covered: the week's balance after the step credit, never more than today's overshoot.
 * The rebalance options work from this number, so they agree with the covered / not covered verdict and no step is spent twice.
 */
export function getRebalanceDebtKcal(c: OvershootCoverage): number {
  return Math.max(0, Math.min(c.overshootKcal, Math.round(c.weekBalanceKcal - c.stepsKcal)));
}

/** One line saying what covered the overshoot. */
export function describeCoverage(c: OvershootCoverage): string {
  if (c.coveredBySteps) {
    const missed = c.shortfallSteps > 0 ? `, אחרי שהופחתו ${c.shortfallSteps.toLocaleString('he-IL')} צעדים שחסרו בימים אחרים` : '';
    return `${c.bonusSteps.toLocaleString('he-IL')} צעדים מעל היעד השבוע${missed} (נטו כ-${c.stepsKcal} קק״ל) מאזנים את העודף של השבוע`;
  }
  if (c.coveredByWeek) return c.stepsKcal < 0 ? `מאזן השבוע עד כה עדיין מתחת ליעד המצטבר, גם אחרי שהצעדים שחסרו (כ-${Math.abs(c.stepsKcal)} קק״ל) נלקחו בחשבון` : 'מאזן השבוע עד כה עדיין מתחת ליעד המצטבר, אז אין צורך באיזון';
  return 'הסטייה של השבוע קטנה מספיק, בתוך הדיוק של ההערכה';
}

/** How much more can be eaten while the week stays in balance (shown when the overshoot is covered); empty when there is no real room. */
export function describeRoom(c: OvershootCoverage): string {
  return c.isCovered && c.roomKcal >= 10 ? `עוד אפשר לאכול כ-${c.roomKcal.toLocaleString('he-IL')} קק״ל ולהישאר מאוזן השבוע.` : '';
}
