import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan } from '../types/fitness';
import { getOvershootCoverage } from './overshoot';
import { getWeeklyCalorieBudget } from './calorieBudget';
import { addDaysIso } from './dateMath';
import { MAX_CARRY_KCAL, deriveWeeklyAdjustment, getWeekCarryIn } from './weekCarry';

const PLAN = { bmr: 1600, tdee: 2400, targetCalories: 2400, macros: { proteinG: 150, fatG: 70, carbsG: 300 }, calorieDeficitOrSurplus: 0 } as NutritionPlan;
const meal = (date: string, calories: number): FoodEntry => ({ id: `${date}-${calories}`, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
const params = (foodLog: FoodEntry[], mode: 'balance_steps' | 'add_calories' = 'balance_steps') => ({ mode, stepLogs: [], foodLog, plan: PLAN, targetDailySteps: 4500, weightKg: 70 });
// Weeks start on Sunday: 9/27, 10/4, 10/11, 10/18.
const week = (sunday: string, kcalPerDay: number) => [0, 1, 2, 3, 4, 5, 6].map((i) => meal(addDaysIso(sunday, i), kcalPerDay));

describe('getWeekCarryIn: what an earlier week leaves for the next one', () => {
  it('calories not eaten last week are room for this one', () => {
    // 7 days at 2,350 against 2,400: 350 under.
    expect(getWeekCarryIn(params(week('2026-10-04', 2350)), '2026-10-11')).toBe(350);
  });

  it('calories eaten over last week are owed this week', () => {
    expect(getWeekCarryIn(params(week('2026-10-04', 2450)), '2026-10-11')).toBe(-350);
  });

  it('is limited both ways, so a very light or very heavy week does not become a licence or a debt of thousands', () => {
    expect(getWeekCarryIn(params(week('2026-10-04', 1800)), '2026-10-11')).toBe(MAX_CARRY_KCAL);
    expect(getWeekCarryIn(params(week('2026-10-04', 3200)), '2026-10-11')).toBe(-MAX_CARRY_KCAL);
  });

  it('is 0 when last week has nothing logged, and a week with nothing logged ends the chain', () => {
    expect(getWeekCarryIn(params(week('2026-10-04', 2350)), '2026-10-18')).toBe(0); // 10/11 is empty
    expect(getWeekCarryIn(params([]), '2026-10-11')).toBe(0);
  });

  it('counts only the days logged: an unlogged last day is not a day of eating nothing', () => {
    const food = week('2026-10-04', 2350).slice(0, 6); // Sunday to Friday: 6 x 50 under
    expect(getWeekCarryIn(params(food), '2026-10-11')).toBe(300);
  });

  it('chains: a week that used the room leaves less, and a week under adds to it', () => {
    // Two weeks ago 350 under (carry 350). Last week 200 over: 350 - 200 = 150 left.
    const food = [...week('2026-09-27', 2350), ...week('2026-10-04', 2400).map((m) => ({ ...m, calories: 2400 + 200 / 7 }))];
    expect(getWeekCarryIn(params(food), '2026-10-11')).toBe(150);
    // A week 400 over after a 350 credit: 50 owed.
    expect(getWeekCarryIn(params([...week('2026-09-27', 2350), ...week('2026-10-04', 2457)]), '2026-10-11')).toBe(-49);
  });

  it('forgets weeks older than four', () => {
    expect(getWeekCarryIn(params(week('2026-08-30', 2350)), '2026-10-11')).toBe(0);
  });

  it('counts the step calories of that week in the calorie mode: they cover what was eaten over, but unspent step calories do not carry over', () => {
    const stepLogs = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ date: addDaysIso('2026-10-04', i), steps: 8500 })); // +160 kcal a day
    // 50 over the base a day: the steps cover it, nothing is left either way.
    expect(getWeekCarryIn({ ...params(week('2026-10-04', 2450), 'add_calories'), stepLogs }, '2026-10-11')).toBe(0);
    // 50 under the base a day: the 350 not eaten carry over, the unspent step calories do not add to them.
    expect(getWeekCarryIn({ ...params(week('2026-10-04', 2350), 'add_calories'), stepLogs }, '2026-10-11')).toBe(350);
  });
});

describe('the carry-over in the week screens', () => {
  // Last week 350 under. Sunday 10/11: ate 2,500, 100 over the day's target.
  const food = [...week('2026-10-04', 2350), meal('2026-10-11', 2500)];
  const adjustment = deriveWeeklyAdjustment(undefined, { ...params(food), today: '2026-10-11' });

  it('puts it on the adjustment of the new week only', () => {
    expect(adjustment?.carryInKcal).toBe(350);
    expect(adjustment?.weekStart).toBe('2026-10-11');
  });

  it('covers an overshoot of the first day with last week\'s unspent calories', () => {
    const coverage = getOvershootCoverage({ foodLog: food, plan: PLAN, adjustment, today: '2026-10-11' });
    expect(coverage.overshootKcal).toBe(100);
    expect(coverage.carryInKcal).toBe(350);
    expect(coverage.weekOverSoFarKcal).toBe(-250);
    expect(coverage.isCovered).toBe(true);
    expect(coverage.roomKcal).toBe(250);
  });

  it('adds it to the week\'s calorie budget', () => {
    const budget = getWeeklyCalorieBudget(food, PLAN, adjustment, '2026-10-11', '2026-10-11');
    expect(budget.carryInKcal).toBe(350);
    expect(budget.weeklyTarget).toBe(7 * 2400 + 350);
  });

  it('a debt from last week counts against the new one', () => {
    const over = [...week('2026-10-04', 2450), meal('2026-10-11', 2400)];
    const adj = deriveWeeklyAdjustment(undefined, { ...params(over), today: '2026-10-11' });
    const coverage = getOvershootCoverage({ foodLog: over, plan: PLAN, adjustment: adj, today: '2026-10-11', todayClosed: true });
    expect(adj?.carryInKcal).toBe(-350);
    expect(coverage.weekOverSoFarKcal).toBe(350);
  });

  it('never trusts a saved carry-over', () => {
    const saved = deriveWeeklyAdjustment({ weekStart: '2026-10-11', carryInKcal: 9999 }, { ...params([]), today: '2026-10-11' });
    expect(saved?.carryInKcal).toBeUndefined();
  });
});
