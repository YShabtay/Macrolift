import { describe, expect, it } from 'vitest';
import type { StepLog } from '../types/fitness';
import { getStepMode, getWeeklyStepsPlan, stepBonusKcal, withStepMode } from './weeklySteps';

const GOAL = 4500;
const steps = (date: string, n: number): StepLog => ({ date, steps: n });
// Sunday 4 Oct to Saturday 10 Oct.

describe('getWeeklyStepsPlan', () => {
  it('shares what is left of the week over the days after the viewed day, and the average so far lowers it', () => {
    // Sunday-Thursday at 5,300 a day: Friday and Saturday are left.
    const logs = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) => steps(d, 5300));
    const plan = getWeeklyStepsPlan(GOAL, logs, '2026-10-08');
    expect(plan.weeklyTarget).toBe(31500);
    expect(plan.daysPassed).toBe(5);
    expect(plan.daysRemaining).toBe(2);
    expect(plan.totalStepsWalked).toBe(26500);
    expect(plan.averageSoFar).toBe(5300);
    expect(plan.remainingNeeded).toBe(5000);
    expect(plan.adjustedDailyTarget).toBe(2500); // each of the two days needs 2,500, less than the 4,500 goal
  });

  it('asks for more when the days so far were short', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 2000), steps('2026-10-05', 2000)], '2026-10-05');
    expect(plan.daysRemaining).toBe(5);
    expect(plan.remainingNeeded).toBe(31500 - 4000);
    expect(plan.adjustedDailyTarget).toBe(Math.round(27500 / 5));
  });

  it('counts a day with no entry as 0 steps, not as a day on target', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 6000)], '2026-10-08');
    expect(plan.totalStepsWalked).toBe(6000);
    expect(plan.averageSoFar).toBe(1200); // 6,000 over the 5 days since Sunday
    expect(plan.remainingNeeded).toBe(25500);
  });

  it('reaches zero once the week is done, and never asks for a negative number', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 40000)], '2026-10-05');
    expect(plan.remainingNeeded).toBe(0);
    expect(plan.adjustedDailyTarget).toBe(0);
  });

  it('on Saturday there is nothing after the day, so the whole rest is shown against one day (no division by zero)', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 20000), steps('2026-10-10', 3000)], '2026-10-10');
    expect(plan.daysPassed).toBe(7);
    expect(plan.daysRemaining).toBe(1);
    expect(plan.adjustedDailyTarget).toBe(31500 - 23000);
  });

  it('adds extra walking a calorie rebalance asked for to the week\'s total', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 5000)], '2026-10-04', 4725);
    expect(plan.weeklyTarget).toBe(31500 + 4725);
    expect(plan.remainingNeeded).toBe(31500 + 4725 - 5000);
  });

  it('counts only steps from Sunday of that week through the viewed day', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-03', 9999), steps('2026-10-04', 1000), steps('2026-10-09', 7777)], '2026-10-05');
    expect(plan.totalStepsWalked).toBe(1000);
  });
});

describe('stepBonusKcal', () => {
  it('turns steps above the goal into calories by body weight (0.04 kcal a step at 70 kg)', () => {
    expect(stepBonusKcal(8500, 4500, 70)).toBe(160);
    expect(stepBonusKcal(8500, 4500, 84)).toBe(192);
  });
  it('is 0 at or under the goal', () => {
    expect(stepBonusKcal(4500, 4500, 70)).toBe(0);
    expect(stepBonusKcal(1000, 4500, 70)).toBe(0);
  });
});

describe('withStepMode', () => {
  const logs = [steps('2026-10-05', 6500), steps('2026-10-06', 3000), steps('2026-10-07', 8500)];
  const base = { mode: 'add_calories' as const, stepLogs: logs, targetDailySteps: GOAL, weightKg: 70, today: '2026-10-07' };

  it('in the calorie mode puts each day\'s steps above the goal on that same day only', () => {
    expect(withStepMode(undefined, base)?.stepAllowance).toEqual({ '2026-10-05': 80, '2026-10-07': 160 });
  });

  it('in the steps mode leaves calories alone, and drops anything an older version saved', () => {
    const saved = { weekStart: '2026-10-04', stepAllowance: { '2026-10-06': 500 }, calorie: { reductionKcal: 90, fromDate: '2026-10-08' } };
    const out = withStepMode(saved, { ...base, mode: 'balance_steps' });
    expect(out?.stepAllowance).toBeUndefined();
    expect(out?.calorie).toEqual({ reductionKcal: 90, fromDate: '2026-10-08' }); // the user's own rebalance choice stays
  });

  it('drops a "walk more" choice in the calorie mode (the goal for the coming days does not change there), and keeps a calorie cut', () => {
    const saved = { weekStart: '2026-10-04', steps: { boost: 1000, days: 2, fromDate: '2026-10-08' }, calorie: { reductionKcal: 90, fromDate: '2026-10-08' } };
    const out = withStepMode(saved, base);
    expect(out?.steps).toBeUndefined();
    expect(out?.calorie).toBeDefined();
    expect(withStepMode(saved, { ...base, mode: 'balance_steps' })?.steps).toEqual(saved.steps);
  });

  it('ignores steps from other weeks and days after today', () => {
    const out = withStepMode(undefined, { ...base, stepLogs: [steps('2026-10-03', 20000), steps('2026-10-09', 20000), steps('2026-10-06', 5500)] });
    expect(out?.stepAllowance).toEqual({ '2026-10-06': 40 });
  });

  it('is undefined when there is nothing to carry', () => {
    expect(withStepMode(undefined, { ...base, stepLogs: [] })).toBeUndefined();
    expect(withStepMode(undefined, { ...base, mode: 'balance_steps' })).toBeUndefined();
  });
});

describe('getStepMode', () => {
  it('defaults to balancing the steps', () => {
    expect(getStepMode({})).toBe('balance_steps');
    expect(getStepMode({ stepMode: 'add_calories' })).toBe('add_calories');
  });
});
