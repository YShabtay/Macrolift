import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, StepLog } from '../types/fitness';
import { describeCoverage, getOvershootCoverage } from './overshoot';

// 2026-10-04 is a Sunday, so the week so far is Sunday, Monday and today, Tuesday.
const SUN = '2026-10-04';
const MON = '2026-10-05';
const TODAY = '2026-10-06';
const PLAN = { bmr: 1700, tdee: 2341, targetCalories: 2341, macros: { proteinG: 150, fatG: 70, carbsG: 250 }, calorieDeficitOrSurplus: 0 } as NutritionPlan;
const BASE_GOAL = 7000;

const meal = (date: string, calories: number): FoodEntry => ({ id: `${date}-${calories}`, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
const steps = (date: string, count: number): StepLog => ({ date, steps: count });

function coverage(foodLog: FoodEntry[], stepLogs: StepLog[] = []) {
  return getOvershootCoverage({ foodLog, plan: PLAN, adjustment: undefined, stepLogs, baseStepGoal: BASE_GOAL, today: TODAY });
}

describe('getOvershootCoverage', () => {
  it('has nothing to cover on a day at or under the target', () => {
    const c = coverage([meal(TODAY, 2341)]);
    expect(c.overshootKcal).toBe(0);
    expect(c.isCovered).toBe(false);
  });

  it('is covered by bonus steps from earlier in the week (the case of 43 kcal over and 4,346 bonus steps)', () => {
    const c = coverage([meal(SUN, 2341), meal(MON, 2341), meal(TODAY, 2384)], [steps(SUN, BASE_GOAL + 4346)]);
    expect(c.overshootKcal).toBe(43);
    expect(c.bonusSteps).toBe(4346);
    expect(c.stepsKcal).toBe(174);
    expect(c.coveredBySteps).toBe(true);
    expect(c.isCovered).toBe(true);
  });

  it('is covered by the week as a whole when the days before were under target', () => {
    const c = coverage([meal(SUN, 1500), meal(MON, 1500), meal(TODAY, 2641)]);
    expect(c.overshootKcal).toBe(300);
    expect(c.weekBalanceKcal).toBeLessThan(0);
    expect(c.coveredBySteps).toBe(false);
    expect(c.coveredByWeek).toBe(true);
    expect(c.isCovered).toBe(true);
  });

  it('is covered by steps and the week together when neither is enough alone', () => {
    // Week +100 over (today +300, Monday -200), and 150 kcal of bonus steps: neither covers it alone, together they do.
    const c = coverage([meal(MON, 2141), meal(TODAY, 2641)], [steps(MON, BASE_GOAL + 3750)]);
    expect(c.overshootKcal).toBe(300);
    expect(c.stepsKcal).toBe(150);
    expect(c.weekBalanceKcal).toBe(100);
    expect(c.coveredBySteps).toBe(false);
    expect(c.coveredByWeek).toBe(true);
    expect(c.isCovered).toBe(true);
    expect(describeCoverage(c)).toContain('יחד');
  });

  it('is not covered when the week is over and the steps do not make up the difference', () => {
    const c = coverage([meal(SUN, 2641), meal(MON, 2641), meal(TODAY, 2641)], [steps(SUN, BASE_GOAL + 1000)]);
    expect(c.overshootKcal).toBe(300);
    expect(c.isCovered).toBe(false);
  });

  it('does not count a single logged overshoot as covered just because other days are missing', () => {
    // Only today is logged: nothing before it can offset it.
    expect(coverage([meal(TODAY, 2800)]).isCovered).toBe(false);
  });

  it('counts steps walked above the goal today as well', () => {
    const c = coverage([meal(TODAY, 2400)], [steps(TODAY, BASE_GOAL + 2000)]);
    expect(c.overshootKcal).toBe(59);
    expect(c.coveredBySteps).toBe(true);
  });
});

describe('describeCoverage', () => {
  it('names the step bonus when it alone covers the overshoot', () => {
    // An over-target week, so only the steps cover today's 43 kcal.
    const text = describeCoverage(coverage([meal(SUN, 2641), meal(MON, 2641), meal(TODAY, 2384)], [steps(SUN, BASE_GOAL + 4346)]));
    expect(text).toContain('4,346');
    expect(text).toContain('כיסו');
  });
});
