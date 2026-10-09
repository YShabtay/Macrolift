import type { FoodEntry, NutritionPlan, StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getEntriesForDate, sumTotals } from './nutritionLog';
import { getDailyTargets, getWeeklyEnergyBalance, sumStepAllowance } from './weeklyBalance';
import { getStepCredit } from './stepCredit';
import { getStepBoostExtraSteps } from './weeklySteps';
import { addDaysIso } from './dateMath';
import { daysBetween, getWeekStart } from './weightCalculations';
import { KCAL_PER_1000_STEPS } from './weeklyBalance';

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
  /** The net step credit still unspent: what the week's walking is worth, minus the part the user already moved into day targets (`stepAllowanceSpentKcal`). */
  stepsKcal: number;
  stepAllowanceSpentKcal: number;
  /** What the week is over by so far, before any steps: the days before this one that have food logged (eaten minus target) plus today's overshoot. Today's unspent target is not counted as room. */
  weekOverSoFarKcal: number;
  /** What the user already planned to make up with a rebalance: the lowered targets of the days after this one, and the extra walking, in kcal. */
  plannedCompensationKcal: number;
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

  const { bonusSteps, shortfallSteps, netKcal } = getStepCredit({ stepLogs, baseGoal: baseStepGoal, adjustment, asOf: today, realToday });
  // Days that carry a step allowance already have that credit in their target, so the week balance holds it: counting it again here would spend it twice.
  const stepAllowanceSpentKcal = sumStepAllowance(adjustment, today, today);
  const stepsKcal = netKcal - stepAllowanceSpentKcal;
  const weekBalanceKcal = getWeeklyEnergyBalance(foodLog, plan, adjustment, today).balanceKcal;
  const netWeek = weekBalanceKcal - stepsKcal;

  // The debt carried from earlier days, which is what the rebalance is for - it does not depend on whether today is over.
  const weekStart = getWeekStart(today);
  let weekOverSoFarKcal = overshootKcal;
  for (let i = 0; i < daysBetween(weekStart, today); i++) {
    const day = addDaysIso(weekStart, i);
    const entries = getEntriesForDate(foodLog, day);
    if (entries.length > 0) weekOverSoFarKcal += sumTotals(entries).calories - getDailyTargets(plan, adjustment, day).calories;
  }
  weekOverSoFarKcal = Math.round(weekOverSoFarKcal);
  let plannedCompensationKcal = (getStepBoostExtraSteps(adjustment, today) * KCAL_PER_1000_STEPS) / 1000;
  for (let i = daysBetween(weekStart, today) + 1; i < 7; i++) plannedCompensationKcal += getDailyTargets(plan, adjustment, addDaysIso(weekStart, i)).reductionKcal;
  plannedCompensationKcal = Math.round(plannedCompensationKcal);

  const isCovered = overshootKcal > 0 && netWeek <= COVERAGE_TOLERANCE_KCAL;
  const coveredByWeek = isCovered && weekBalanceKcal <= 0;
  const coveredBySteps = isCovered && weekBalanceKcal > 0 && stepsKcal > 0;
  const roomKcal = isCovered ? Math.max(Math.round(-netWeek), 0) : 0;

  return { overshootKcal, isCovered, bonusSteps, shortfallSteps, stepsKcal, stepAllowanceSpentKcal, weekOverSoFarKcal, plannedCompensationKcal, coveredByWeek, coveredBySteps, weekBalanceKcal, roomKcal };
}

/**
 * What the rebalance works from: the week's overshoot so far (earlier days included, not only today's) after the net step credit. It is what the options
 * offer to make up, so they agree with the covered / not covered verdict and no step is spent twice. 0 when the steps already cover it.
 */
export function getRebalanceDebtKcal(c: OvershootCoverage): number {
  return Math.max(0, Math.round(c.weekOverSoFarKcal - c.stepsKcal));
}

/** What is still open: the rebalance debt minus what the user already planned to make up (lowered targets ahead, extra walking). */
export function getOpenRebalanceDebtKcal(c: OvershootCoverage): number {
  return Math.max(0, getRebalanceDebtKcal(c) - c.plannedCompensationKcal);
}

/** Whether to offer the rebalance: there is a debt worth making up, or one the user already chose to make up and may want to revisit. */
export function shouldOfferRebalance(c: OvershootCoverage): boolean {
  return getRebalanceDebtKcal(c) > COVERAGE_TOLERANCE_KCAL;
}

/** The days of the week up to `today` that went over their target (with food logged), for showing where the overshoot came from. */
export function getOvershootDays(params: { foodLog: FoodEntry[]; plan: NutritionPlan; adjustment: WeeklyBalanceAdjustment | undefined; today: string }): { date: string; overKcal: number }[] {
  const { foodLog, plan, adjustment, today } = params;
  const weekStart = getWeekStart(today);
  const days: { date: string; overKcal: number }[] = [];
  for (let i = 0; i <= daysBetween(weekStart, today); i++) {
    const day = addDaysIso(weekStart, i);
    const entries = getEntriesForDate(foodLog, day);
    if (entries.length === 0) continue;
    const over = Math.round(sumTotals(entries).calories - getDailyTargets(plan, adjustment, day).calories);
    if (over >= 20) days.push({ date: day, overKcal: over });
  }
  return days;
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
