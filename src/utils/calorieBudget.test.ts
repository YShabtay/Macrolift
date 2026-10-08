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
});
