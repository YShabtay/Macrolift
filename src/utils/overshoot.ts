import type { FoodEntry, NutritionPlan, WeeklyBalanceAdjustment } from '../types/fitness';
import { getEntriesForDate, sumTotals } from './nutritionLog';
import { KCAL_PER_1000_STEPS, getDailyTargets, getStepAllowanceKcal, getStepAppliedKcal, getWeeklyEnergyBalance } from './weeklyBalance';
import { getStepBoostExtraSteps } from './weeklySteps';
import { addDaysIso } from './dateMath';
import { daysBetween, getWeekStart } from './weightCalculations';

/** The calorie estimates are approximate, so a week this close to its target counts as in balance. */
export const COVERAGE_TOLERANCE_KCAL = 50;

export interface OvershootCoverage {
  /** Calories over the day's target; 0 when the day is at or under it. */
  overshootKcal: number;
  /** True when the overshoot needs no action: the week as a whole is still in balance. */
  isCovered: boolean;
  /** Eaten minus target for the week so far (the day's whole target counts as room). The days' targets already hold any step calories ('add_calories' mode). */
  weekBalanceKcal: number;
  /** When covered: how many more kcal can be eaten and the week still stays in balance. 0 otherwise. */
  roomKcal: number;
  /**
   * The step calories ('add_calories' mode) in today's target that were not eaten: the room above the base target that is still unused. It counts against the
   * week's overshoot, because walking that was not turned into eating pays down what the earlier days went over; eating that room gives the credit back.
   */
  unspentBankKcal: number;
  /**
   * What the week is over by so far: the days before this one that have food logged (eaten minus target) plus this day's overshoot. The day's unspent target
   * is not room while the day is still open; once the person says they are done eating for the day, what was not eaten counts as saved.
   */
  weekOverSoFarKcal: number;
  /** The spare step calories (calorie mode) that already cancelled part of the overshoot, so they are not room to eat: they are taken off `weekOverSoFarKcal`. */
  stepsAppliedKcal: number;
  /** What finishing the day now would take off the week's overshoot (the part of the day's base target not eaten); 0 when the day is over its target. */
  closableKcal: number;
  /** Whether the day was closed by the person, so its saved calories are already part of `weekOverSoFarKcal`. */
  isDayClosed: boolean;
  /** What the user already planned to make up with a rebalance: the lowered targets of the days after this one, and the extra walking, in kcal. */
  plannedCompensationKcal: number;
}

/**
 * Whether a day's calorie overshoot is already made up for by the week, so it can be shown as covered and how much room is left. The body answers
 * to the week, not to one day, so the test is the week: eaten minus target over the days logged so far. Steps are not part of it: in the 'add_calories'
 * mode they already raised that day's own target, and in the 'balance_steps' mode they never touch calories.
 */
export function getOvershootCoverage(params: {
  foodLog: FoodEntry[];
  plan: NutritionPlan;
  adjustment: WeeklyBalanceAdjustment | undefined;
  /** The day being judged; the week is counted up to it. */
  today: string;
  /** The person marked this day as done eating: what was not eaten is counted as saved, as it will be after midnight. */
  todayClosed?: boolean;
}): OvershootCoverage {
  const { foodLog, plan, adjustment, today, todayClosed = false } = params;
  const eaten = sumTotals(getEntriesForDate(foodLog, today)).calories;
  const target = getDailyTargets(plan, adjustment, today).calories;
  const overshootKcal = Math.max(Math.round(eaten - target), 0);
  const weekBalanceKcal = getWeeklyEnergyBalance(foodLog, plan, adjustment, today).balanceKcal;

  const isCovered = overshootKcal > 0 && weekBalanceKcal <= COVERAGE_TOLERANCE_KCAL;
  const roomKcal = isCovered ? Math.max(Math.round(-weekBalanceKcal), 0) : 0;

  // The overshoot carried from earlier days, which is what the rebalance is for - it does not depend on whether today is over.
  const weekStart = getWeekStart(today);
  const dayIndex = daysBetween(weekStart, today);
  const bankToday = getStepAllowanceKcal(adjustment, today);
  const usedToday = Math.min(bankToday, Math.max(0, eaten - (target - bankToday)));
  const unspentBankKcal = Math.max(0, bankToday - usedToday);
  // An open day counts only what it went over (less the step calories it still holds); a closed one counts what it ended up against its base target.
  const closableKcal = Math.max(0, target - unspentBankKcal - eaten);
  const stepsAppliedKcal = getStepAppliedKcal(adjustment, today);
  let weekOverSoFarKcal = (todayClosed ? eaten - target + unspentBankKcal : overshootKcal - unspentBankKcal) - stepsAppliedKcal;
  for (let i = 0; i < dayIndex; i++) {
    const day = addDaysIso(weekStart, i);
    const entries = getEntriesForDate(foodLog, day);
    if (entries.length > 0) weekOverSoFarKcal += sumTotals(entries).calories - getDailyTargets(plan, adjustment, day).calories;
  }
  let plannedCompensationKcal = (getStepBoostExtraSteps(adjustment, today) * KCAL_PER_1000_STEPS) / 1000;
  for (let i = dayIndex + 1; i < 7; i++) plannedCompensationKcal += getDailyTargets(plan, adjustment, addDaysIso(weekStart, i)).reductionKcal;

  return { overshootKcal, isCovered, weekBalanceKcal, roomKcal, unspentBankKcal: Math.round(unspentBankKcal), weekOverSoFarKcal: Math.round(weekOverSoFarKcal), closableKcal: Math.round(closableKcal), stepsAppliedKcal, isDayClosed: todayClosed, plannedCompensationKcal: Math.round(plannedCompensationKcal) };
}

/** What the rebalance works from: the week's overshoot so far, earlier days included. 0 when the week is at or under its target. */
export function getRebalanceDebtKcal(c: OvershootCoverage): number {
  return Math.max(0, c.weekOverSoFarKcal);
}

/** What is still open: the overshoot minus what the user already planned to make up (lowered targets ahead, extra walking). */
export function getOpenRebalanceDebtKcal(c: OvershootCoverage): number {
  return Math.max(0, getRebalanceDebtKcal(c) - c.plannedCompensationKcal);
}

/** Whether to offer the rebalance: the week is over by more than the tolerance, or the user already chose a way to make it up and may want to change it. */
export function shouldOfferRebalance(c: OvershootCoverage): boolean {
  return getRebalanceDebtKcal(c) > COVERAGE_TOLERANCE_KCAL;
}

export interface WeekDayRow {
  date: string;
  eatenKcal: number;
  /** The day's target, with any step calories it carries. */
  targetKcal: number;
  /** Eaten minus target (negative = under). */
  diffKcal: number;
  isToday: boolean;
}

/**
 * Every day of the week up to `today` that has food logged, with what was eaten against the target. This is the table behind "the week is over by X": the
 * days before today add up as they are (under-eating cancels over-eating), and today counts only if it is over, because its unspent target is not a credit.
 */
export function getWeekBreakdown(params: { foodLog: FoodEntry[]; plan: NutritionPlan; adjustment: WeeklyBalanceAdjustment | undefined; today: string }): WeekDayRow[] {
  const { foodLog, plan, adjustment, today } = params;
  const weekStart = getWeekStart(today);
  const rows: WeekDayRow[] = [];
  for (let i = 0; i <= daysBetween(weekStart, today); i++) {
    const day = addDaysIso(weekStart, i);
    const entries = getEntriesForDate(foodLog, day);
    if (entries.length === 0) continue;
    const eatenKcal = Math.round(sumTotals(entries).calories);
    const targetKcal = Math.round(getDailyTargets(plan, adjustment, day).calories);
    rows.push({ date: day, eatenKcal, targetKcal, diffKcal: eatenKcal - targetKcal, isToday: day === today });
  }
  return rows;
}

/** One line saying why the overshoot is covered. */
export function describeCoverage(c: OvershootCoverage): string {
  return c.weekBalanceKcal <= 0 ? 'מאזן השבוע עד כה עדיין מתחת ליעד המצטבר, אז אין צורך באיזון' : 'הסטייה של השבוע קטנה מספיק, בתוך הדיוק של ההערכה';
}

/** How much more can be eaten while the week stays in balance (shown when the overshoot is covered); empty when there is no real room. */
export function describeRoom(c: OvershootCoverage): string {
  return c.isCovered && c.roomKcal >= 10 ? `עוד אפשר לאכול כ-${c.roomKcal.toLocaleString('he-IL')} קק״ל ולהישאר מאוזן השבוע.` : '';
}
