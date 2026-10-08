import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan } from '../types/fitness';
import { getWeeklyCalorieBudget } from './calorieBudget';

// The user's real week: Sunday 4 Oct to Wednesday 7 Oct eaten against a 2,412 target; today is Thursday.
const PLAN = { bmr: 1613, tdee: 2383, targetCalories: 2412, macros: { proteinG: 138, fatG: 62, carbsG: 326 }, calorieDeficitOrSurplus: 29 } as NutritionPlan;
const meal = (date: string, calories: number): FoodEntry => ({ id: `${date}`, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
const LOG = [meal('2026-10-04', 2385), meal('2026-10-05', 2329), meal('2026-10-06', 2384), meal('2026-10-07', 2690)];
const TODAY = '2026-10-08';

describe('getWeeklyCalorieBudget pace', () => {
  it('without step credit, the 140 kcal the week is over lowers the recommendation under the daily target', () => {
    const pace = getWeeklyCalorieBudget(LOG, PLAN, undefined, TODAY, TODAY).pace!;
    expect(pace.kcal).toBe(2365);
    expect(pace.stepCreditKcal).toBe(0);
  });

  it('adds back what the bonus steps already burned, so it agrees with the overshoot-covered check', () => {
    const pace = getWeeklyCalorieBudget(LOG, PLAN, undefined, TODAY, TODAY, 227).pace!;
    expect(pace.kcal).toBe(2441); // (16,884 - 9,788 + 227) / 3 days
    expect(pace.stepCreditKcal).toBe(227);
  });

  it('subtracts steps the week fell short by', () => {
    expect(getWeeklyCalorieBudget(LOG, PLAN, undefined, TODAY, TODAY, -90).pace!.kcal).toBe(2335);
  });

  describe('with a step allowance put on days', () => {
    const allow = (entries: Record<string, number>) => ({ weekStart: '2026-10-04', stepAllowance: entries });
    const pace = (adj: ReturnType<typeof allow> | undefined, credit = 169) => getWeeklyCalorieBudget(LOG, PLAN, adj, TODAY, TODAY, credit);

    it('keeps the old numbers without one: the credit is shared over the three days left', () => {
      expect(pace(undefined).pace!.kcal).toBe(2422);
    });
    it('gives all the credit to today when it is allocated to today alone, and leaves the other days at their share', () => {
      const p = pace(allow({ [TODAY]: 169 })).pace!;
      expect(p.kcal).toBe(2534); // 7,096 / 3 + 169
      expect(p.target).toBe(2412 + 169); // today's own target carries it
      expect(p.allowanceDays).toBe(1);
    });
    it('gives half to each of two days', () => {
      const p = pace(allow({ [TODAY]: 85, '2026-10-09': 85 })).pace!;
      expect(p.kcal).toBe(2450);
      expect(p.allowanceDays).toBe(2);
    });
    it('adds the allowances to the week total shown, but not twice to the pace of a day without one', () => {
      const budget = pace(allow({ '2026-10-09': 169 }));
      expect(budget.weeklyTarget).toBe(16884 + 169);
      expect(budget.pace!.kcal).toBe(2365); // tomorrow carries the credit, not today
    });
    it('does not let an allowance eaten on an earlier day shrink the base budget', () => {
      const budget = getWeeklyCalorieBudget(LOG, PLAN, allow({ '2026-10-07': 100 }), TODAY, TODAY, 169);
      // Wednesday ate 2,690 against a target raised by 100: only 2,590 of it came out of the base budget.
      expect(budget.pace!.kcal).toBe(Math.round((16884 - 9788 + 100) / 3 + (169 - 100) / 3));
    });
  });
});
