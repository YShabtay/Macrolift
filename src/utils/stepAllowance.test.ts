import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, StepLog } from '../types/fitness';
import { chooseStepAllowance, countAllowanceDaysFrom } from './stepAllowance';
import { getOvershootCoverage, getRebalanceDebtKcal } from './overshoot';
import { getWeeklyCalorieBudget } from './calorieBudget';
import { getStepCredit } from './stepCredit';
import { getDailyTargets } from './weeklyBalance';

// The user's week: Sunday 4 Oct to Thursday 8 Oct against a 2,412 target, goal 4,500 steps, net step credit 163 kcal as of Thursday.
const PLAN = { bmr: 1613, tdee: 2383, targetCalories: 2412, macros: { proteinG: 138, fatG: 62, carbsG: 326 }, calorieDeficitOrSurplus: 29 } as NutritionPlan;
const meal = (date: string, calories: number): FoodEntry => ({ id: date, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
const LOG = [meal('2026-10-04', 2385), meal('2026-10-05', 2329), meal('2026-10-06', 2384), meal('2026-10-07', 2690), meal('2026-10-08', 2630)];
const STEPS: StepLog[] = [
  { date: '2026-10-04', steps: 8846 },
  { date: '2026-10-05', steps: 3818 },
  { date: '2026-10-06', steps: 5821 },
  { date: '2026-10-07', steps: 2344 },
  { date: '2026-10-08', steps: 5758 },
];
const TODAY = '2026-10-08';
const choose = (days: number | null, adjustment?: Parameters<typeof chooseStepAllowance>[0]['adjustment'], today = TODAY) =>
  chooseStepAllowance({ adjustment, stepLogs: STEPS, baseStepGoal: 4500, today, days });
const credit = getStepCredit({ stepLogs: STEPS, baseGoal: 4500, adjustment: undefined, asOf: TODAY }).netKcal;

describe('chooseStepAllowance', () => {
  it('puts the whole net credit on today for "today only", and half on each of two days', () => {
    expect(credit).toBe(163);
    expect(choose(1).stepAllowance).toEqual({ '2026-10-08': 163 });
    expect(choose(2).stepAllowance).toEqual({ '2026-10-08': 82, '2026-10-09': 82 });
  });
  it('with null, or as many days as are left, leaves the credit unallocated', () => {
    expect(choose(null).stepAllowance).toBeUndefined();
    expect(choose(3).stepAllowance).toBeUndefined();
  });
  it('keeps the entries of earlier days when the choice changes, and allocates only what is left of the credit', () => {
    const earlier = { weekStart: '2026-10-04', stepAllowance: { '2026-10-07': 50 } };
    const next = choose(1, earlier).stepAllowance!;
    expect(next['2026-10-07']).toBe(50);
    expect(next['2026-10-08']).toBe(163 - 50);
  });
  it('replaces a previous choice for today onward, and keeps other rebalance choices', () => {
    const before = { weekStart: '2026-10-04', calorie: { reductionKcal: 90, fromDate: '2026-10-09' }, stepAllowance: { '2026-10-08': 160, '2026-10-09': 160 } };
    const after = choose(1, before);
    expect(after.stepAllowance).toEqual({ '2026-10-08': 163 });
    expect(after.calorie).toEqual(before.calorie);
    expect(choose(null, before).stepAllowance).toBeUndefined();
  });
  it('can start from yesterday while it is still being logged, using the credit as it stood that day, and leaves earlier days alone', () => {
    // Yesterday is Wednesday: the credit as of Wednesday counts the finished Monday and Wednesday as well.
    const fromWed = chooseStepAllowance({ adjustment: undefined, stepLogs: STEPS, baseStepGoal: 4500, today: TODAY, days: 1, from: '2026-10-07' });
    expect(fromWed.stepAllowance).toEqual({ '2026-10-07': 113 });
    const earlier = { weekStart: '2026-10-04', stepAllowance: { '2026-10-06': 30, '2026-10-08': 99 } };
    const next = chooseStepAllowance({ adjustment: earlier, stepLogs: STEPS, baseStepGoal: 4500, today: TODAY, days: 2, from: '2026-10-07' }).stepAllowance!;
    expect(next['2026-10-06']).toBe(30); // before the start: kept
    expect(next['2026-10-08']).toBe(42); // replaced: (113 - 30) / 2
    expect(next['2026-10-07']).toBe(42);
  });
  it('does nothing when there is no real credit', () => {
    const noSteps = chooseStepAllowance({ adjustment: undefined, stepLogs: [], baseStepGoal: 4500, today: TODAY, days: 1 });
    expect(noSteps.stepAllowance).toBeUndefined();
  });
  it('counts the days from today that carry an allowance', () => {
    expect(countAllowanceDaysFrom(choose(2), TODAY)).toBe(2);
    expect(countAllowanceDaysFrom(choose(null), TODAY)).toBe(0);
  });
});

describe('the choice is the same number on every screen, with no credit spent twice', () => {
  const adjustment = choose(1);
  const coverage = (adj: typeof adjustment | undefined) => getOvershootCoverage({ foodLog: LOG, plan: PLAN, adjustment: adj, stepLogs: STEPS, baseStepGoal: 4500, today: TODAY });

  it("today's target, the weekly card and the pace all carry the same 163", () => {
    expect(getDailyTargets(PLAN, adjustment, TODAY).calories).toBe(2412 + 163);
    const budget = getWeeklyCalorieBudget(LOG, PLAN, adjustment, TODAY, TODAY, credit);
    expect(budget.pace!.target).toBe(2412 + 163);
    expect(budget.pace!.kcal).toBe(Math.round(7096 / 3 + 163));
    expect(budget.weeklyTarget).toBe(16884 + 163);
  });

  it('the overshoot shrinks by the allowance, and the credit is not subtracted a second time', () => {
    const without = coverage(undefined);
    const withIt = coverage(adjustment);
    expect(without.overshootKcal).toBe(218);
    expect(withIt.overshootKcal).toBe(218 - 163);
    expect(withIt.stepAllowanceSpentKcal).toBe(163);
    expect(withIt.stepsKcal).toBe(0); // all of the net credit is already in today's target
    // The week balance fell by the allowance (the target is higher), and the unspent credit fell by the same amount: the debt moves only by the allowance.
    expect(without.weekBalanceKcal - withIt.weekBalanceKcal).toBe(163);
    // What is left to make up is the week's overshoot so far (earlier days included) after the net step credit: 140 from before today plus today's 55.
    expect(withIt.weekOverSoFarKcal).toBe(195);
    expect(getRebalanceDebtKcal(withIt)).toBe(195);
  });

  it('a day with an allowance is judged the same way when it is looked at later', () => {
    const later = getOvershootCoverage({ foodLog: LOG, plan: PLAN, adjustment, stepLogs: STEPS, baseStepGoal: 4500, today: TODAY, realToday: '2026-10-09' });
    expect(later.stepAllowanceSpentKcal).toBe(163);
  });
});
