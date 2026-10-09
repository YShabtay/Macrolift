import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, WeeklyBalanceAdjustment } from '../types/fitness';
import { applyRebalanceChoice, buildRebalanceOptions, getActiveAdjustment, getDailyTargets, getWeeklyEnergyBalance } from './weeklyBalance';

// 2026-10-04 is a Sunday: the app's weeks run Sunday to Saturday.
const SUNDAY = '2026-10-04';
const MONDAY = '2026-10-05';
const TUESDAY = '2026-10-06';
const WEDNESDAY = '2026-10-07';
const SATURDAY = '2026-10-10';

const plan: NutritionPlan = {
  bmr: 1800,
  tdee: 2500,
  targetCalories: 2500,
  macros: { proteinG: 150, fatG: 70, carbsG: 300 },
  calorieDeficitOrSurplus: 0,
};

function meal(date: string, calories: number): FoodEntry {
  return { id: `${date}-${calories}`, date, meal: 'lunch', name: 'x', quantity: '1', calories, proteinG: 0, fatG: 0, carbsG: 0 } as FoodEntry;
}

describe('getActiveAdjustment', () => {
  const adjustment: WeeklyBalanceAdjustment = { weekStart: SUNDAY, calorie: { reductionKcal: 100, fromDate: MONDAY } };

  it('applies within its own week, including Saturday', () => {
    expect(getActiveAdjustment(adjustment, WEDNESDAY)).toBe(adjustment);
    expect(getActiveAdjustment(adjustment, SATURDAY)).toBe(adjustment);
  });

  it('is ignored once the next week starts', () => {
    expect(getActiveAdjustment(adjustment, '2026-10-11')).toBeUndefined();
  });
});

describe('getDailyTargets', () => {
  const adjustment: WeeklyBalanceAdjustment = { weekStart: SUNDAY, calorie: { reductionKcal: 180, fromDate: TUESDAY } };

  it('returns the base plan with no adjustment', () => {
    expect(getDailyTargets(plan, undefined, WEDNESDAY)).toEqual({ calories: 2500, macros: plan.macros, reductionKcal: 0, allowanceKcal: 0 });
  });

  it('adds a step allowance to that day only, all of it to carbs, and ignores one saved for another week', () => {
    const withAllowance = { weekStart: SUNDAY, stepAllowance: { [WEDNESDAY]: 120 } };
    const t = getDailyTargets(plan, withAllowance, WEDNESDAY);
    expect(t).toMatchObject({ calories: 2620, allowanceKcal: 120, reductionKcal: 0 });
    expect(t.macros).toEqual({ ...plan.macros, carbsG: plan.macros.carbsG + 30 });
    expect(getDailyTargets(plan, withAllowance, MONDAY).allowanceKcal).toBe(0);
    expect(getDailyTargets(plan, { ...withAllowance, weekStart: '2026-09-27' }, WEDNESDAY).allowanceKcal).toBe(0);
  });

  it('stacks with a rebalance reduction instead of replacing it', () => {
    const both = { weekStart: SUNDAY, calorie: { reductionKcal: 100, fromDate: MONDAY }, stepAllowance: { [WEDNESDAY]: 120 } };
    expect(getDailyTargets(plan, both, WEDNESDAY).calories).toBe(2500 - 100 + 120);
  });

  it('does not touch days before the reduction starts', () => {
    expect(getDailyTargets(plan, adjustment, MONDAY).calories).toBe(2500);
  });

  it('lowers calories from the start date on, leaving protein untouched', () => {
    const day = getDailyTargets(plan, adjustment, WEDNESDAY);
    expect(day.calories).toBe(2320);
    expect(day.reductionKcal).toBe(180);
    expect(day.macros.proteinG).toBe(150);
  });

  it('takes the reduction out of fat and carbs (the macro calories drop by about the same amount)', () => {
    const { macros } = getDailyTargets(plan, adjustment, WEDNESDAY);
    const before = plan.macros.fatG * 9 + plan.macros.carbsG * 4;
    const after = macros.fatG * 9 + macros.carbsG * 4;
    expect(macros.fatG).toBeLessThan(plan.macros.fatG);
    expect(macros.carbsG).toBeLessThan(plan.macros.carbsG);
    expect(Math.abs(before - after - 180)).toBeLessThanOrEqual(7);
  });

  it("never applies last week's reduction", () => {
    expect(getDailyTargets(plan, adjustment, '2026-10-12').calories).toBe(2500);
  });
});

describe('getWeeklyEnergyBalance', () => {
  it('counts only days with logged food, plus today', () => {
    const log = [meal(SUNDAY, 2000), meal(TUESDAY, 2600)]; // Monday was not tracked
    const balance = getWeeklyEnergyBalance(log, plan, undefined, WEDNESDAY);
    expect(balance.daysCounted).toBe(3); // Sunday, Tuesday and today
    expect(balance.eatenKcal).toBe(4600);
    expect(balance.targetKcal).toBe(7500);
    expect(balance.balanceKcal).toBe(-2900);
  });

  it('ignores food logged in other weeks', () => {
    const balance = getWeeklyEnergyBalance([meal('2026-09-30', 9999)], plan, undefined, WEDNESDAY);
    expect(balance.eatenKcal).toBe(0);
    expect(balance.daysCounted).toBe(1);
  });

  it('uses the lowered target on days a rebalance covers', () => {
    const adjustment: WeeklyBalanceAdjustment = { weekStart: SUNDAY, calorie: { reductionKcal: 200, fromDate: TUESDAY } };
    const balance = getWeeklyEnergyBalance([meal(TUESDAY, 2000), meal(WEDNESDAY, 2000)], plan, adjustment, WEDNESDAY);
    expect(balance.targetKcal).toBe(2 * 2300);
  });
});

describe('buildRebalanceOptions', () => {
  it('splits a one-time overshoot over the remaining days instead of repeating it per day', () => {
    const options = buildRebalanceOptions(400, plan, WEDNESDAY); // Thursday, Friday, Saturday remain
    expect(options.daysRemaining).toBe(3);
    expect(options.taper).toMatchObject({ available: true, perDayKcal: 133, days: 3, fromDate: '2026-10-08', capped: false });
  });

  it('converts calories to steps at about 40 kcal per 1,000 steps', () => {
    const options = buildRebalanceOptions(400, plan, WEDNESDAY);
    expect(options.totalStepsToBurn).toBe(10000);
    expect(options.stepsSpread).toMatchObject({ available: true, perDay: 3333, days: 3 });
    expect(options.stepsOneDay).toMatchObject({ steps: 10000, date: '2026-10-08', isToday: false, capped: false });
  });

  it('needs nothing when there is no overshoot', () => {
    const options = buildRebalanceOptions(0, plan, WEDNESDAY);
    expect(options.netStepsNeeded).toBe(0);
    expect(options.taper.available).toBe(false);
    expect(options.stepsOneDay.goalIncrease).toBe(0);
  });

  it('limits the daily trim to a safe share of the target and never below BMR', () => {
    const lowPlan: NutritionPlan = { ...plan, bmr: 1400, targetCalories: 1500 };
    const options = buildRebalanceOptions(900, lowPlan, WEDNESDAY); // wants 300/day, but only 100 is above BMR
    expect(options.taper).toMatchObject({ perDayKcal: 100, capped: true });
  });

  it('caps a single-day walking catch-up at 10,000 steps', () => {
    const options = buildRebalanceOptions(1000, plan, WEDNESDAY); // 25,000 steps of energy
    expect(options.stepsOneDay.steps).toBe(10000);
    expect(options.stepsOneDay.capped).toBe(true);
  });

  it('offers no spreading on the last day of the week, only catching up today', () => {
    const options = buildRebalanceOptions(400, plan, SATURDAY);
    expect(options.daysRemaining).toBe(0);
    expect(options.taper.available).toBe(false);
    expect(options.stepsSpread.available).toBe(false);
    expect(options.stepsOneDay).toMatchObject({ isToday: true, date: SATURDAY });
  });
});

const rebalanceBase = { weekStart: '2026-10-04', stepAllowance: { '2026-10-08': 100 } };

describe('applyRebalanceChoice', () => {
  it('lowers the next days, and replaces an earlier walking choice', () => {
    const withSteps = { ...rebalanceBase, steps: { boost: 1000, days: 2, fromDate: '2026-10-09' } };
    const next = applyRebalanceChoice(withSteps, { kind: 'taper', reductionKcal: 98, fromDate: '2026-10-09' });
    expect(next.calorie).toEqual({ reductionKcal: 98, fromDate: '2026-10-09' });
    expect(next.steps).toBeUndefined();
  });
  it('walks more, and replaces an earlier lowered-target choice', () => {
    const withTaper = { ...rebalanceBase, calorie: { reductionKcal: 98, fromDate: '2026-10-09' } };
    const next = applyRebalanceChoice(withTaper, { kind: 'steps', boost: 2400, days: 2, fromDate: '2026-10-09' });
    expect(next.steps).toMatchObject({ boost: 2400, days: 2 });
    expect(next.calorie).toBeUndefined();
  });
  it('"carry on as usual" clears both, so the planned compensation can be cancelled', () => {
    const both = { ...rebalanceBase, calorie: { reductionKcal: 98, fromDate: '2026-10-09' }, steps: { boost: 1000, days: 2, fromDate: '2026-10-09' } };
    const next = applyRebalanceChoice(both, { kind: 'keep' });
    expect(next.calorie).toBeUndefined();
    expect(next.steps).toBeUndefined();
  });
  it('never touches the step allowances the user put on days', () => {
    expect(applyRebalanceChoice(rebalanceBase, { kind: 'keep' }).stepAllowance).toEqual({ '2026-10-08': 100 });
    expect(applyRebalanceChoice(rebalanceBase, { kind: 'taper', reductionKcal: 50, fromDate: '2026-10-09' }).stepAllowance).toEqual({ '2026-10-08': 100 });
  });
});
