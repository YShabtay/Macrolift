import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan } from '../types/fitness';
import {
  COVERAGE_TOLERANCE_KCAL,
  describeCoverage,
  describeRoom,
  getOpenRebalanceDebtKcal,
  getOvershootCoverage,
  getOvershootDays,
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

describe('getOvershootDays', () => {
  it('lists the days that went over, with how much', () => {
    const log = [meal('2026-10-04', 2400), meal('2026-10-05', 2800), meal('2026-10-06', 2650)];
    expect(getOvershootDays({ foodLog: log, plan: PLAN, adjustment: undefined, today: '2026-10-06' })).toEqual([
      { date: '2026-10-05', overKcal: 400 },
      { date: '2026-10-06', overKcal: 250 },
    ]);
  });
});
