import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan } from '../types/fitness';
import {
  COVERAGE_TOLERANCE_KCAL,
  describeCoverage,
  describeRoom,
  getOpenRebalanceDebtKcal,
  getOvershootCoverage,
  getWeekBreakdown,
  getRebalanceDebtKcal,
  shouldOfferRebalance,
} from './overshoot';

// 2026-10-04 is a Sunday. Target 2,400 a day.
const PLAN = { bmr: 1600, tdee: 2400, targetCalories: 2400, macros: { proteinG: 150, fatG: 70, carbsG: 300 }, calorieDeficitOrSurplus: 0 } as NutritionPlan;
const meal = (date: string, calories: number): FoodEntry => ({ id: `${date}-${calories}`, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
const coverage = (foodLog: FoodEntry[], today: string, adjustment?: Parameters<typeof getOvershootCoverage>[0]['adjustment']) => getOvershootCoverage({ foodLog, plan: PLAN, adjustment, today });

describe('getOvershootCoverage', () => {
  it('has nothing to cover on a day at or under the target', () => {
    const c = coverage([meal('2026-10-06', 2400)], '2026-10-06');
    expect(c.overshootKcal).toBe(0);
    expect(c.isCovered).toBe(false);
  });

  it('is covered when the days before were under target, with the room that leaves', () => {
    const c = coverage([meal('2026-10-04', 1500), meal('2026-10-05', 1500), meal('2026-10-06', 2700)], '2026-10-06');
    expect(c.overshootKcal).toBe(300);
    expect(c.isCovered).toBe(true);
    expect(c.roomKcal).toBe(c.weekBalanceKcal * -1);
    expect(describeCoverage(c)).toContain('אין צורך באיזון');
    expect(describeRoom(c)).toContain(c.roomKcal.toLocaleString('he-IL'));
  });

  it('is not covered when the week is over', () => {
    const c = coverage([meal('2026-10-04', 2800), meal('2026-10-05', 2800), meal('2026-10-06', 2800)], '2026-10-06');
    expect(c.isCovered).toBe(false);
    expect(c.roomKcal).toBe(0);
  });

  it('counts a week within the estimate tolerance as in balance', () => {
    const c = coverage([meal('2026-10-04', 2400), meal('2026-10-05', 2400), meal('2026-10-06', 2400 + COVERAGE_TOLERANCE_KCAL + 20)], '2026-10-06');
    expect(c.weekBalanceKcal).toBe(COVERAGE_TOLERANCE_KCAL + 20);
    expect(c.isCovered).toBe(false);
    const near = coverage([meal('2026-10-04', 2400), meal('2026-10-05', 2400), meal('2026-10-06', 2400 + COVERAGE_TOLERANCE_KCAL)], '2026-10-06');
    expect(near.isCovered).toBe(true);
  });

  it('sees earlier days\' overshoot on a morning with nothing eaten yet, and does not count the day\'s unspent target as room', () => {
    const c = coverage([meal('2026-10-04', 2400), meal('2026-10-05', 2800)], '2026-10-06');
    expect(c.overshootKcal).toBe(0);
    expect(c.weekOverSoFarKcal).toBe(400);
    expect(getRebalanceDebtKcal(c)).toBe(400);
    expect(shouldOfferRebalance(c)).toBe(true);
  });

  it('judges a past day as it stood at the end of that day', () => {
    const log = [meal('2026-10-04', 2400), meal('2026-10-05', 2800), meal('2026-10-06', 2000)];
    expect(coverage(log, '2026-10-05').weekOverSoFarKcal).toBe(400);
    // Tuesday ate 2,000 against 2,400, but a day that is still going never counts its unspent target as a credit against earlier days.
    expect(coverage(log, '2026-10-06').weekOverSoFarKcal).toBe(400);
  });
});

describe('planned compensation and the open amount', () => {
  const log = [meal('2026-10-04', 2400), meal('2026-10-05', 2800)];

  it('counts the lowered targets of the days after, and the extra walking, as already planned', () => {
    const planned = { weekStart: '2026-10-04', calorie: { reductionKcal: 100, fromDate: '2026-10-07' }, steps: { boost: 1000, days: 2, fromDate: '2026-10-07' } };
    const c = coverage(log, '2026-10-06', planned);
    expect(c.plannedCompensationKcal).toBe(100 * 4 + 80); // Wednesday to Saturday lowered, and 2,000 extra steps
    expect(getOpenRebalanceDebtKcal(c)).toBe(Math.max(0, 400 - 480));
  });

  it('leaves the open amount at the whole overshoot when nothing was planned, and offers the screen while there is something to make up', () => {
    const c = coverage(log, '2026-10-06');
    expect(getOpenRebalanceDebtKcal(c)).toBe(400);
    expect(shouldOfferRebalance(c)).toBe(true);
    expect(shouldOfferRebalance(coverage([meal('2026-10-04', 2400)], '2026-10-06'))).toBe(false);
  });
});

describe('getWeekBreakdown', () => {
  it('lists every logged day with eaten, target and the difference, and adds up to the week over so far', () => {
    const log = [meal('2026-10-04', 2300), meal('2026-10-05', 2800), meal('2026-10-06', 2650)];
    const rows = getWeekBreakdown({ foodLog: log, plan: PLAN, adjustment: undefined, today: '2026-10-06' });
    expect(rows.map((r) => [r.date, r.eatenKcal, r.targetKcal, r.diffKcal, r.isToday])).toEqual([
      ['2026-10-04', 2300, 2400, -100, false],
      ['2026-10-05', 2800, 2400, 400, false],
      ['2026-10-06', 2650, 2400, 250, true],
    ]);
    // Days before today add up as they are; today adds only its overshoot.
    const beforeToday = rows.filter((r) => !r.isToday).reduce((sum, r) => sum + r.diffKcal, 0);
    expect(beforeToday + Math.max(rows[2].diffKcal, 0)).toBe(coverage(log, '2026-10-06').weekOverSoFarKcal);
  });

  it('skips days with nothing logged, and shows a day\'s step calories in its target', () => {
    const adjustment = { weekStart: '2026-10-04', stepAllowance: { '2026-10-05': 100 } };
    const rows = getWeekBreakdown({ foodLog: [meal('2026-10-05', 2500)], plan: PLAN, adjustment, today: '2026-10-06' });
    expect(rows).toEqual([{ date: '2026-10-05', eatenKcal: 2500, targetKcal: 2500, diffKcal: 0, isToday: false }]);
  });
});

describe('marking the day as done eating', () => {
  // Sunday to Tuesday: 2,400 / 2,800 / 2,500 eaten against 2,400 a day = +500 before Wednesday; Wednesday (today) has eaten 2,100 so far.
  const week = [meal('2026-10-04', 2400), meal('2026-10-05', 2800), meal('2026-10-06', 2500), meal('2026-10-07', 2100)];
  const open = coverage(week, '2026-10-07');
  const closed = getOvershootCoverage({ foodLog: week, plan: PLAN, adjustment: undefined, today: '2026-10-07', todayClosed: true });

  it('keeps the unspent part of an open day out of the count, and says what closing it would save', () => {
    expect(open.weekOverSoFarKcal).toBe(500);
    expect(open.closableKcal).toBe(300);
    expect(open.isDayClosed).toBe(false);
  });

  it('counts what was not eaten as saved once the day is closed, the same as it will count after midnight', () => {
    expect(closed.weekOverSoFarKcal).toBe(200);
    expect(closed.isDayClosed).toBe(true);
    const tomorrow = coverage(week, '2026-10-08'); // Wednesday is now a day before today
    expect(tomorrow.weekOverSoFarKcal).toBe(closed.weekOverSoFarKcal);
  });

  it('a closed day that went over the target counts its overshoot, just like an open one', () => {
    const over = [...week.slice(0, 3), meal('2026-10-07', 2700)];
    const asOpen = coverage(over, '2026-10-07');
    const asClosed = getOvershootCoverage({ foodLog: over, plan: PLAN, adjustment: undefined, today: '2026-10-07', todayClosed: true });
    expect(asClosed.weekOverSoFarKcal).toBe(asOpen.weekOverSoFarKcal);
    expect(asClosed.closableKcal).toBe(0);
  });

  it('does not credit the step calories the day left unspent: they roll to tomorrow', () => {
    // Calorie mode: today's target holds 100 step calories (base 2,400, target 2,500). 2,350 eaten is 50 under the BASE target: only that is saved.
    const adjustment = { weekStart: '2026-10-04', stepAllowance: { '2026-10-07': 100 } };
    const food = [meal('2026-10-07', 2350)];
    const c = getOvershootCoverage({ foodLog: food, plan: PLAN, adjustment, today: '2026-10-07', todayClosed: true });
    expect(c.weekOverSoFarKcal).toBe(-50);
    expect(c.unspentBankKcal).toBe(100);
  });
});

