import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan } from '../types/fitness';
import {
  COVERAGE_TOLERANCE_KCAL,
  describeCoverage,
  describeRoom,
  getOpenRebalanceDebtKcal,
  getRangeHeadroomKcal,
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
    expect(rows.map((r) => [r.date, r.eatenKcal, r.ceilingKcal, r.diffKcal, r.isToday])).toEqual([
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
    expect(rows).toEqual([{ date: '2026-10-05', eatenKcal: 2500, ceilingKcal: 2500, diffKcal: 0, isToday: false }]);
  });
});

describe('the recommended range: eating inside it is not an overshoot', () => {
  // A bulk starts at the low end of its range: target 2,400, the range goes up to 2,600.
  const RANGE_PLAN = { ...PLAN, targetMin: 2400, targetMax: 2600 } as NutritionPlan;
  const inRange = (foodLog: FoodEntry[], today: string, adjustment?: Parameters<typeof getOvershootCoverage>[0]['adjustment']) =>
    getOvershootCoverage({ foodLog, plan: RANGE_PLAN, adjustment, today });

  it('knows how far above the target the range goes, and none for a plan without one', () => {
    expect(getRangeHeadroomKcal(RANGE_PLAN)).toBe(200);
    expect(getRangeHeadroomKcal(PLAN)).toBe(0);
    expect(getRangeHeadroomKcal({ ...PLAN, targetMax: 2400 } as NutritionPlan)).toBe(0); // a cut starts at the top of its range
  });

  it('a day above the target but under the top of the range is shown calmly, with the room left to the top', () => {
    const c = inRange([meal('2026-10-06', 2550)], '2026-10-06');
    expect(c.overshootKcal).toBe(0);
    expect(c.isWithinRange).toBe(true);
    expect(c.ceilingKcal).toBe(2600);
    expect(c.roomKcal).toBe(50);
    expect(describeCoverage(c)).toContain('בתוך הטווח');
    expect(describeRoom(c)).toContain('50');
  });

  it('a day above the top of the range is an overshoot by the part above it', () => {
    const c = inRange([meal('2026-10-06', 2700)], '2026-10-06');
    expect(c.isWithinRange).toBe(false);
    expect(c.overshootKcal).toBe(100);
  });

  it('a whole week eaten inside the range offers no rebalance', () => {
    const log = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'].map((d) => meal(d, 2550));
    const c = inRange(log, '2026-10-08');
    expect(c.weekOverSoFarKcal).toBeLessThan(0);
    expect(shouldOfferRebalance(c)).toBe(false);
  });

  it('only what is above the top of the range counts toward the week, and the breakdown shows the same ceiling', () => {
    const log = [meal('2026-10-04', 2550), meal('2026-10-05', 2900), meal('2026-10-06', 2500)];
    const c = inRange(log, '2026-10-07');
    // Sunday -50, Monday +300, Tuesday -100 against the 2,600 top.
    expect(c.weekOverSoFarKcal).toBe(150);
    const rows = getWeekBreakdown({ foodLog: log, plan: RANGE_PLAN, adjustment: undefined, today: '2026-10-07' });
    expect(rows.map((r) => [r.ceilingKcal, r.diffKcal])).toEqual([[2600, -50], [2600, 300], [2600, -100]]);
  });
});
