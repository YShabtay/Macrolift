import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan } from '../types/fitness';
import { getWeeklyCalorieBudget } from './calorieBudget';

// A week against a 2,412 target; today is Thursday 8 October.
const PLAN = { bmr: 1613, tdee: 2383, targetCalories: 2412, macros: { proteinG: 138, fatG: 62, carbsG: 326 }, calorieDeficitOrSurplus: 29 } as NutritionPlan;
const meal = (date: string, calories: number): FoodEntry => ({ id: date, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
const LOG = [meal('2026-10-04', 2385), meal('2026-10-05', 2329), meal('2026-10-06', 2384), meal('2026-10-07', 2690)];
const TODAY = '2026-10-08';

describe('getWeeklyCalorieBudget pace', () => {
  it('spreads what is left of the week over the days left, today included', () => {
    const pace = getWeeklyCalorieBudget(LOG, PLAN, undefined, TODAY, TODAY).pace!;
    expect(pace.daysLeft).toBe(3);
    expect(pace.kcal).toBe(Math.round((16884 - 9788) / 3)); // 2,365
    expect(pace.stepBonusKcal).toBe(0);
  });

  it('keeps the day inside the flex limits', () => {
    const big = [meal('2026-10-04', 500)];
    expect(getWeeklyCalorieBudget(big, PLAN, undefined, TODAY, TODAY).pace!.clamped).toBe('up');
  });

  describe('with calories from steps on days (the calorie mode)', () => {
    const adj = (entries: Record<string, number>) => ({ weekStart: '2026-10-04', stepAllowance: entries });

    it('gives today\'s step calories to today only, and leaves the other days at their share', () => {
      const budget = getWeeklyCalorieBudget(LOG, PLAN, adj({ [TODAY]: 160 }), TODAY, TODAY);
      expect(budget.pace!.kcal).toBe(Math.round((16884 - 9788) / 3 + 160));
      expect(budget.pace!.target).toBe(2412 + 160);
      expect(budget.pace!.stepBonusKcal).toBe(160);
      expect(budget.weeklyTarget).toBe(16884 + 160);
    });

    it('a bonus on an earlier day is not spread over the days left, and does not shrink the base budget', () => {
      const budget = getWeeklyCalorieBudget(LOG, PLAN, adj({ '2026-10-07': 100 }), TODAY, TODAY);
      // Wednesday ate 2,690 against a target raised by 100: only 2,590 of it came out of the base budget.
      expect(budget.pace!.kcal).toBe(Math.round((16884 - 9788 + 100) / 3));
    });
  });
});
