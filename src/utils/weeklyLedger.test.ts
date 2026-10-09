import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, StepLog } from '../types/fitness';
import { getWeeklyStepsPlan, withStepMode } from './weeklySteps';
import { getOpenRebalanceDebtKcal, getOvershootCoverage, getRebalanceDebtKcal } from './overshoot';
import { getWeeklyCalorieBudget } from './calorieBudget';
import { applyRebalanceChoice, buildRebalanceOptions, getDailyTargets } from './weeklyBalance';

/**
 * One story checked on every screen's numbers at once: a daily step goal of 4,500, Sunday to Thursday at 5,500 steps a day, Wednesday 400 kcal over, 70 kg.
 * In each mode the steps do one thing, and the screens agree: in "balance steps" they only change what the days left need, in "add calories" they only
 * change the calories of the day they were walked on. Never both, so nothing is counted twice.
 */
const GOAL = 4500;
const WEIGHT = 70;
const PLAN = { bmr: 1600, tdee: 2400, targetCalories: 2400, macros: { proteinG: 150, fatG: 70, carbsG: 300 }, calorieDeficitOrSurplus: 0 } as NutritionPlan;
const meal = (date: string, calories: number): FoodEntry => ({ id: date, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
const DAYS = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'] as const; // Sunday to Thursday
const FOOD = [meal(DAYS[0], 2400), meal(DAYS[1], 2400), meal(DAYS[2], 2400), meal(DAYS[3], 2800), meal(DAYS[4], 2400)];
const STEPS: StepLog[] = DAYS.map((date) => ({ date, steps: 5500 }));
const FRIDAY = '2026-10-09';
const adjustmentFor = (mode: 'balance_steps' | 'add_calories', base?: Parameters<typeof withStepMode>[0]) =>
  withStepMode(base, { mode, stepLogs: STEPS, targetDailySteps: GOAL, weightKg: WEIGHT, today: FRIDAY });
const coverageFor = (adjustment: ReturnType<typeof adjustmentFor>) => getOvershootCoverage({ foodLog: FOOD, plan: PLAN, adjustment, today: FRIDAY });

describe('mode "balance steps" (the default): walking changes only what the days left need', () => {
  const adjustment = adjustmentFor('balance_steps');

  it('shows the average so far and a lower goal for the two days left', () => {
    const plan = getWeeklyStepsPlan(GOAL, STEPS, '2026-10-08');
    expect(plan.averageSoFar).toBe(5500);
    expect(plan.daysRemaining).toBe(2);
    expect(plan.adjustedDailyTarget).toBe((31500 - 27500) / 2); // 2,000 a day
  });

  it('leaves every calorie number alone', () => {
    for (const day of ['2026-10-04', '2026-10-07', FRIDAY]) expect(getDailyTargets(PLAN, adjustment, day).calories).toBe(2400);
    const c = coverageFor(adjustment);
    expect(c.weekOverSoFarKcal).toBe(400); // Wednesday's overshoot, whole
    expect(getRebalanceDebtKcal(c)).toBe(400);
  });

  it('the overshoot is made up by walking more, which goes into the week\'s step total, and then counts as planned', () => {
    const debt = getRebalanceDebtKcal(coverageFor(adjustment));
    const options = buildRebalanceOptions(debt, PLAN, FRIDAY);
    expect(options.netStepsNeeded).toBe(10000); // 400 kcal of steps
    const chosen = applyRebalanceChoice({ weekStart: '2026-10-04' }, { kind: 'steps', boost: options.stepsOneDay.storedBoost, days: 1, fromDate: options.stepsOneDay.date, toDate: options.stepsOneDay.date });
    expect(coverageFor(adjustmentFor('balance_steps', chosen)).plannedCompensationKcal).toBe(400);
    expect(getOpenRebalanceDebtKcal(coverageFor(adjustmentFor('balance_steps', chosen)))).toBe(0);
  });
});

describe('mode "add calories": walking changes only the calories of the day it was walked on', () => {
  const adjustment = adjustmentFor('add_calories');

  it('adds each day\'s steps above the goal to that day\'s target, and nothing to the other days', () => {
    // 1,000 steps above the goal at 70 kg = 40 kcal.
    for (const day of DAYS) expect(getDailyTargets(PLAN, adjustment, day).calories).toBe(2440);
    expect(getDailyTargets(PLAN, adjustment, FRIDAY).calories).toBe(2400); // Friday has no steps yet
  });

  it('keeps the step goal for the days left exactly as set', () => {
    // The plan still computes a share, but the screen shows only the goal in this mode; the goal itself never moves.
    expect(getWeeklyStepsPlan(GOAL, STEPS, FRIDAY).targetDailySteps).toBe(GOAL);
  });

  it('the overshoot shrinks by the calories the steps added, once, and the budget card agrees', () => {
    const c = coverageFor(adjustment);
    expect(c.weekOverSoFarKcal).toBe(200); // 400 over on Wednesday, less 5 x 40 kcal from the steps, with Wednesday itself at 2,800 against 2,440
    expect(getRebalanceDebtKcal(c)).toBe(200);
    const pace = getWeeklyCalorieBudget(FOOD, PLAN, adjustment, FRIDAY, FRIDAY).pace!;
    expect(pace.stepBonusKcal).toBe(0); // today has no steps yet
    expect(pace.target).toBe(2400);
  });

  it('walking today adds to today and to nothing else', () => {
    const withToday = withStepMode(undefined, { mode: 'add_calories', stepLogs: [...STEPS, { date: FRIDAY, steps: 9500 }], targetDailySteps: GOAL, weightKg: WEIGHT, today: FRIDAY });
    expect(getDailyTargets(PLAN, withToday, FRIDAY).calories).toBe(2400 + 200); // 5,000 above the goal
    expect(getDailyTargets(PLAN, withToday, '2026-10-10').calories).toBe(2400); // Saturday is untouched
  });

  it('a "walk more" rebalance is not available here: it is dropped, the goal does not change', () => {
    const chosen = applyRebalanceChoice({ weekStart: '2026-10-04' }, { kind: 'steps', boost: 2000, days: 2, fromDate: '2026-10-10' });
    expect(adjustmentFor('add_calories', chosen)?.steps).toBeUndefined();
  });
});

describe('switching between the two modes', () => {
  it('changes only how the same steps are used: steps into calories, or into a lower goal, never both', () => {
    const steps = adjustmentFor('balance_steps');
    const calories = adjustmentFor('add_calories');
    expect(coverageFor(steps).weekOverSoFarKcal).toBe(400);
    expect(coverageFor(calories).weekOverSoFarKcal).toBe(200);
    expect(getWeeklyStepsPlan(GOAL, STEPS, '2026-10-08').adjustedDailyTarget).toBe(2000); // the step side only reads the steps in either mode
  });
});
