import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, WeeklyBalanceAdjustment } from '../types/fitness';
import { getWeeklyCalorieBudget } from './calorieBudget';
import { getOvershootCoverage } from './overshoot';
import { getDailyTargets, getWeeklyEnergyBalance } from './weeklyBalance';

const PLAN = { bmr: 1600, tdee: 2400, targetCalories: 2400, macros: { proteinG: 150, fatG: 70, carbsG: 300 }, calorieDeficitOrSurplus: 0 } as NutritionPlan;
const meal = (date: string, calories: number): FoodEntry => ({ id: `${date}-${calories}`, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
// Sunday 10/11 ate 300 over; Monday 10/12 is today.
const SUNDAY = '2026-10-11';
const MONDAY = '2026-10-12';
const offset = (kcal: number): WeeklyBalanceAdjustment => ({ weekStart: SUNDAY, todayOffset: { date: MONDAY, kcal } });
const cover = (monday: number, adjustment?: WeeklyBalanceAdjustment) =>
  getOvershootCoverage({ foodLog: [meal(SUNDAY, 2700), meal(MONDAY, monday)], plan: PLAN, adjustment, today: MONDAY });

describe('using the day\'s remaining target against the overshoot', () => {
  it('lowers that day\'s target, and only that day\'s', () => {
    expect(getDailyTargets(PLAN, offset(100), MONDAY).calories).toBe(2300);
    expect(getDailyTargets(PLAN, offset(100), SUNDAY).calories).toBe(2400);
    expect(getDailyTargets(PLAN, offset(100), '2026-10-13').calories).toBe(2400);
    expect(getDailyTargets(PLAN, { weekStart: '2026-10-04', todayOffset: { date: MONDAY, kcal: 100 } }, MONDAY).calories).toBe(2400); // another week
  });

  it('takes the used calories off the week\'s overshoot, and leaves nothing of the day\'s target to count again', () => {
    const before = cover(2300);
    expect(before.weekOverSoFarKcal).toBe(300);
    expect(before.closableKcal).toBe(100);
    const after = cover(2300, offset(100));
    expect(after.weekOverSoFarKcal).toBe(200);
    expect(after.closableKcal).toBe(0);
    expect(after.todayOffsetKcal).toBe(100);
    expect(after.overshootKcal).toBe(0);
  });

  it('eating more than the lowered target gives the difference back, exactly as without the offset', () => {
    // 50 more than the lowered target: the week is where eating 2,350 without any offset would have left it (300 + (2350 - 2400)).
    expect(cover(2350, offset(100)).weekOverSoFarKcal).toBe(250);
    expect(cover(2350).weekOverSoFarKcal).toBe(300); // an open day: what is not eaten yet is not a saving
    expect(cover(2450, offset(100)).weekOverSoFarKcal).toBe(350);
  });

  it('is the same as closing the day, when it was all used', () => {
    const closed = getOvershootCoverage({ foodLog: [meal(SUNDAY, 2700), meal(MONDAY, 2300)], plan: PLAN, adjustment: undefined, today: MONDAY, todayClosed: true });
    expect(closed.weekOverSoFarKcal).toBe(cover(2300, offset(100)).weekOverSoFarKcal);
  });

  it('does not change the week\'s budget: the calories move inside it', () => {
    const food = [meal(SUNDAY, 2700), meal(MONDAY, 2300)];
    expect(getWeeklyEnergyBalance(food, PLAN, offset(100), MONDAY)).toEqual(getWeeklyEnergyBalance(food, PLAN, { weekStart: SUNDAY }, MONDAY));
    const withOffset = getWeeklyCalorieBudget(food, PLAN, offset(100), MONDAY, MONDAY);
    const without = getWeeklyCalorieBudget(food, PLAN, { weekStart: SUNDAY }, MONDAY, MONDAY);
    expect(withOffset.weeklyTarget).toBe(without.weeklyTarget);
    expect(withOffset.remaining).toBe(without.remaining);
  });
});
