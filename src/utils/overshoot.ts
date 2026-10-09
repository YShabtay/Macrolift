import type { FoodEntry, NutritionPlan, WeeklyBalanceAdjustment } from '../types/fitness';
import { getEntriesForDate, sumTotals } from './nutritionLog';
import { KCAL_PER_1000_STEPS, getDailyTargets, getWeeklyEnergyBalance } from './weeklyBalance';
import { getStepBoostExtraSteps } from './weeklySteps';
import { addDaysIso } from './dateMath';
import { daysBetween, getWeekStart } from './weightCalculations';

/** The calorie estimates are approximate, so a week this close to its target counts as in balance. */
export const COVERAGE_TOLERANCE_KCAL = 50;

/**
 * How far above the day's target the recommended range goes. The plan starts a bulk at the low end of its range (and a cut at the high end) as a safety
 * margin, so eating between the target and the top of the range is inside what the app itself recommends and is not an overshoot. 0 when there is no range
 * or the target already is its top (a cut).
 */
export function getRangeHeadroomKcal(plan: NutritionPlan): number {
  return Math.max(0, Math.round((plan.targetMax ?? plan.targetCalories) - plan.targetCalories));
}

export interface OvershootCoverage {
  /** Calories above the top of the day's range (its target plus the range's headroom); 0 while the day is inside the range. */
  overshootKcal: number;
  /** Above the day's target but still inside the recommended range: shown calmly, not as a problem. */
  isWithinRange: boolean;
  /** The top of the day's range. */
  ceilingKcal: number;
  /** True when the overshoot needs no action: the week as a whole is still in balance. */
  isCovered: boolean;
  /** Eaten minus the range's top for the week so far (the day's whole range counts as room). The days' targets already hold any step calories ('add_calories' mode). */
  weekBalanceKcal: number;
  /** When covered or inside the range: how many more kcal can be eaten and stay inside it. 0 otherwise. */
  roomKcal: number;
  /** What the week is over by so far, against the top of each day's range: the days before this one that have food logged (eaten minus the range's top) plus this day's overshoot. The day's unspent range is not room. */
  weekOverSoFarKcal: number;
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
}): OvershootCoverage {
  const { foodLog, plan, adjustment, today } = params;
  const eaten = sumTotals(getEntriesForDate(foodLog, today)).calories;
  const target = getDailyTargets(plan, adjustment, today).calories;
  const headroom = getRangeHeadroomKcal(plan);
  const ceilingKcal = Math.round(target + headroom);
  const overshootKcal = Math.max(Math.round(eaten - ceilingKcal), 0);
  const isWithinRange = eaten > target && Math.round(eaten) <= ceilingKcal;
  const balance = getWeeklyEnergyBalance(foodLog, plan, adjustment, today);
  const weekBalanceKcal = balance.balanceKcal - headroom * balance.daysCounted;

  const isCovered = overshootKcal > 0 && weekBalanceKcal <= COVERAGE_TOLERANCE_KCAL;
  const roomKcal = isWithinRange ? Math.max(ceilingKcal - Math.round(eaten), 0) : isCovered ? Math.max(Math.round(-weekBalanceKcal), 0) : 0;

  // The overshoot carried from earlier days, which is what the rebalance is for - it does not depend on whether today is over.
  const weekStart = getWeekStart(today);
  const dayIndex = daysBetween(weekStart, today);
  let weekOverSoFarKcal = overshootKcal;
  for (let i = 0; i < dayIndex; i++) {
    const day = addDaysIso(weekStart, i);
    const entries = getEntriesForDate(foodLog, day);
    if (entries.length > 0) weekOverSoFarKcal += sumTotals(entries).calories - getDailyTargets(plan, adjustment, day).calories - headroom;
  }
  let plannedCompensationKcal = (getStepBoostExtraSteps(adjustment, today) * KCAL_PER_1000_STEPS) / 1000;
  for (let i = dayIndex + 1; i < 7; i++) plannedCompensationKcal += getDailyTargets(plan, adjustment, addDaysIso(weekStart, i)).reductionKcal;

  return { overshootKcal, isWithinRange, ceilingKcal, isCovered, weekBalanceKcal, roomKcal, weekOverSoFarKcal: Math.round(weekOverSoFarKcal), plannedCompensationKcal: Math.round(plannedCompensationKcal) };
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
  /** The top of the day's range: its target (with any step calories it carries) plus the range's headroom. */
  ceilingKcal: number;
  /** Eaten minus the top of the range (negative = under). */
  diffKcal: number;
  isToday: boolean;
}

/**
 * Every day of the week up to `today` that has food logged, with what was eaten against the top of its range. This is the table behind "the week is over by X": the
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
    const ceilingKcal = Math.round(getDailyTargets(plan, adjustment, day).calories + getRangeHeadroomKcal(plan));
    rows.push({ date: day, eatenKcal, ceilingKcal, diffKcal: eatenKcal - ceilingKcal, isToday: day === today });
  }
  return rows;
}

/** One line saying why the day is fine. */
export function describeCoverage(c: OvershootCoverage): string {
  if (c.isWithinRange) return `זה בתוך הטווח המומלץ (עד ${c.ceilingKcal.toLocaleString('he-IL')} קק״ל)`;
  return c.weekBalanceKcal <= 0 ? 'מאזן השבוע עד כה עדיין מתחת לתקרת הטווח, אז אין צורך באיזון' : 'הסטייה של השבוע קטנה מספיק, בתוך הדיוק של ההערכה';
}

/** How much more can be eaten while staying inside the range or the week's balance (shown when the day is fine); empty when there is no real room. */
export function describeRoom(c: OvershootCoverage): string {
  return (c.isCovered || c.isWithinRange) && c.roomKcal >= 10 ? `עוד אפשר לאכול כ-${c.roomKcal.toLocaleString('he-IL')} קק״ל ולהישאר בטווח.` : '';
}
