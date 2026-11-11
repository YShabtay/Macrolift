import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, StepLog } from '../types/fitness';
import { getStepBankDebtKcal, getStepCalorieBank, getStepMode, getWeeklyStepsPlan, getWeekStepSurplus, sanitizeStepSurplus, stepBonusKcal, stepNetKcal, withStepMode } from './weeklySteps';

const GOAL = 4500;
const steps = (date: string, n: number): StepLog => ({ date, steps: n });
const PLAN = { bmr: 1600, tdee: 2400, targetCalories: 2400, macros: { proteinG: 150, fatG: 70, carbsG: 300 }, calorieDeficitOrSurplus: 0 } as NutritionPlan;
const meal = (date: string, calories: number): FoodEntry => ({ id: `${date}-${calories}`, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
// Sunday 4 Oct to Saturday 10 Oct.

describe('getWeeklyStepsPlan: today is a day still to walk', () => {
  const sunToThu = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) => steps(d, 5300));

  it('on a Friday morning with nothing entered, gives a sensible target for Friday and Saturday', () => {
    const plan = getWeeklyStepsPlan(GOAL, sunToThu, '2026-10-09');
    expect(plan.daysBefore).toBe(5);
    expect(plan.daysRemaining).toBe(2); // Friday and Saturday
    expect(plan.walkedBeforeToday).toBe(26500);
    expect(plan.averageBefore).toBe(5300);
    expect(plan.stepsNeeded).toBe(31500 - 26500);
    expect(plan.targetForTodayAndRemaining).toBe(2500);
    expect(plan.leftToday).toBe(2500);
  });

  it('keeps the target while the day\'s steps are entered, and only what is left of it moves', () => {
    const plan = getWeeklyStepsPlan(GOAL, [...sunToThu, steps('2026-10-09', 1000)], '2026-10-09');
    expect(plan.targetForTodayAndRemaining).toBe(2500);
    expect(plan.stepsOnDay).toBe(1000);
    expect(plan.leftToday).toBe(1500);
    expect(getWeeklyStepsPlan(GOAL, [...sunToThu, steps('2026-10-09', 9000)], '2026-10-09').leftToday).toBe(0);
  });

  it('asks for more when the days before were short', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 2000), steps('2026-10-05', 2000)], '2026-10-06');
    expect(plan.daysRemaining).toBe(5); // Tuesday to Saturday
    expect(plan.targetForTodayAndRemaining).toBe(Math.round((31500 - 4000) / 5));
  });

  it('counts a day with no entry as 0 steps', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 6000)], '2026-10-08'); // Monday to Wednesday have no entry
    expect(plan.walkedBeforeToday).toBe(6000);
    expect(plan.averageBefore).toBe(1500); // 6,000 over the 4 days before Thursday
    expect(plan.daysRemaining).toBe(3);
    expect(plan.targetForTodayAndRemaining).toBe(Math.round(25500 / 3));
  });

  it('on Sunday the whole week is ahead and there is no average yet', () => {
    const plan = getWeeklyStepsPlan(GOAL, [], '2026-10-04');
    expect(plan.daysRemaining).toBe(7);
    expect(plan.averageBefore).toBeNull();
    expect(plan.targetForTodayAndRemaining).toBe(GOAL);
  });

  it('on Saturday the day itself is the last one, with no division by zero', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 20000), steps('2026-10-05', 3000)], '2026-10-10');
    expect(plan.daysRemaining).toBe(1);
    expect(plan.targetForTodayAndRemaining).toBe(31500 - 23000);
  });

  it('reaches zero once the week is covered, and never asks for a negative number', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 40000)], '2026-10-05');
    expect(plan.stepsNeeded).toBe(0);
    expect(plan.targetForTodayAndRemaining).toBe(0);
  });

  it('adds extra walking a calorie rebalance asked for to the week\'s total', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-04', 5000)], '2026-10-05', 4725);
    expect(plan.weeklyTarget).toBe(31500 + 4725);
    expect(plan.stepsNeeded).toBe(31500 + 4725 - 5000);
  });

  it('counts only steps from Sunday of that week up to the day before the viewed day', () => {
    const plan = getWeeklyStepsPlan(GOAL, [steps('2026-10-03', 9999), steps('2026-10-04', 1000), steps('2026-10-05', 7777), steps('2026-10-09', 7777)], '2026-10-05');
    expect(plan.walkedBeforeToday).toBe(1000);
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

describe('getStepCalorieBank: calories not eaten roll over within the week', () => {
  const bank = (stepLogs: StepLog[], foodLog: FoodEntry[], today: string) =>
    getStepCalorieBank({ baseAdjustment: undefined, plan: PLAN, stepLogs, foodLog, targetDailySteps: GOAL, weightKg: 70, today });
  // Sunday +80 (6,500 steps), Monday 0, Tuesday +160 (8,500), Wednesday +40 (5,500).
  const logs = [steps('2026-10-04', 6500), steps('2026-10-05', 4500), steps('2026-10-06', 8500), steps('2026-10-07', 5500)];

  it('keeps a bonus that was not eaten past midnight and uses it on the day the user eats above the base target', () => {
    // Sunday ate exactly the base target: its 80 kcal wait. Monday ate 80 above base: it spends them.
    const result = bank(logs, [meal('2026-10-04', 2400), meal('2026-10-05', 2480), meal('2026-10-06', 2400)], '2026-10-07');
    expect(result.allowance['2026-10-04']).toBeUndefined(); // nothing was eaten above the base that day
    expect(result.allowance['2026-10-05']).toBe(80); // Sunday's bonus, spent on Monday
    expect(result.allowance['2026-10-06']).toBeUndefined();
    expect(result.carriedIntoToday).toBe(160); // Tuesday's bonus, still unspent
    expect(result.bonusToday).toBe(40);
    expect(result.availableToday).toBe(200);
    expect(result.allowance['2026-10-07']).toBe(200); // today's target = base + the whole bank
  });

  it('a day that eats more than the bank uses all of it, and the bank starts again from that day\'s own steps', () => {
    const result = bank(logs, [meal('2026-10-04', 2400), meal('2026-10-05', 2400), meal('2026-10-06', 2700)], '2026-10-07');
    expect(result.allowance['2026-10-06']).toBe(80 + 160); // Sunday's and Tuesday's, both spent on Tuesday's 300 above base (only 240 available)
    expect(result.carriedIntoToday).toBe(0);
    expect(result.availableToday).toBe(40);
  });

  it('a day with no food logged keeps the whole bank', () => {
    const result = bank(logs, [], '2026-10-07');
    expect(result.carriedIntoToday).toBe(80 + 160);
    expect(Object.keys(result.allowance)).toEqual(['2026-10-07']);
  });

  it('resets on Sunday: steps from the week before are not carried', () => {
    const result = bank([steps('2026-10-09', 20000)], [], '2026-10-11');
    expect(result.availableToday).toBe(0);
    expect(result.allowance).toEqual({});
  });

  it('never puts the same calories in two days\' targets', () => {
    const food = [meal('2026-10-04', 2400), meal('2026-10-05', 2500), meal('2026-10-06', 2400)];
    const result = bank(logs, food, '2026-10-07');
    const totalAllowance = Object.values(result.allowance).reduce((a, b) => a + b, 0);
    const totalEarned = 80 + 0 + 160 + 40;
    expect(totalAllowance).toBeLessThanOrEqual(totalEarned);
    expect(result.allowance['2026-10-05']).toBe(80); // Monday spent Sunday's bonus (it ate 100 above base), and was still 20 over
    expect(result.appliedWeek).toBe(20 + 0); // Tuesday's 160 first cancelled those 20
    expect(result.carriedIntoToday).toBe(140); // the rest of Tuesday's bonus waits
  });
});

describe('getStepCalorieBank: spare calories pay the week\'s overshoot before they are room to eat', () => {
  const bank = (stepLogs: StepLog[], foodLog: FoodEntry[], today: string) =>
    getStepCalorieBank({ baseAdjustment: undefined, plan: PLAN, stepLogs, foodLog, targetDailySteps: GOAL, weightKg: 70, today });

  it('uses a day\'s spare calories on the overshoot of the days before, then on the day itself, and carries what is left', () => {
    // Monday ate 300 above the base with nothing spare: the week is 300 over. Tuesday walks 4,000 above the goal (+160): all 160 cancels it, nothing is room.
    const logs = [steps('2026-10-05', 4500), steps('2026-10-06', 8500)];
    const result = bank(logs, [meal('2026-10-05', 2700)], '2026-10-07');
    expect(result.allowance['2026-10-06']).toBeUndefined();
    expect(result.appliedWeek).toBe(160);
    expect(result.availableToday).toBe(0);
  });

  it('what is more than the overshoot becomes room for that day', () => {
    // Overshoot 100; Tuesday's 160 cancels it and leaves 60 to carry into today.
    const logs = [steps('2026-10-05', 4500), steps('2026-10-06', 8500)];
    const result = bank(logs, [meal('2026-10-05', 2500)], '2026-10-07');
    expect(result.appliedWeek).toBe(100);
    expect(result.carriedIntoToday).toBe(60);
    expect(result.allowance['2026-10-07']).toBe(60);
  });

  it('days under their target count as saved against the overshoot, so there may be nothing to cancel', () => {
    // Monday 300 over, Tuesday 400 under: the week is 100 under, so Wednesday's spare calories are room.
    const logs = [steps('2026-10-07', 8500)];
    const food = [meal('2026-10-05', 2700), meal('2026-10-06', 2000)];
    const result = bank(logs, food, '2026-10-07');
    expect(result.appliedWeek).toBe(0);
    expect(result.allowance['2026-10-07']).toBe(160);
  });
});

describe('getStepCalorieBank: a day below the goal is netted against the days above it', () => {
  const bank = (stepLogs: StepLog[], today: string, foodLog: FoodEntry[] = []) =>
    getStepCalorieBank({ baseAdjustment: undefined, plan: PLAN, stepLogs, foodLog, targetDailySteps: GOAL, weightKg: 70, today });

  it('takes the calories of a short day off the bank before they become food', () => {
    // Sunday +160 (8,500), Monday 3,000 steps = -60: 100 are left, then today's own steps add 40.
    const r = bank([steps('2026-10-04', 8500), steps('2026-10-05', 3000), steps('2026-10-06', 5500)], '2026-10-06');
    expect(r.carriedIntoToday).toBe(100);
    expect(r.availableToday).toBe(140);
    expect(r.allowance['2026-10-06']).toBe(140);
  });

  it('a short day before any surplus is a debt the later days pay first, and the bank never goes below 0 for today', () => {
    // Sunday 3,000 (-60), Monday 8,500 (+160): 100. Tuesday (today) 0 steps: still 100.
    expect(bank([steps('2026-10-04', 3000), steps('2026-10-05', 8500)], '2026-10-06').availableToday).toBe(100);
    // Only short days: nothing to eat, never a negative allowance.
    const short = bank([steps('2026-10-04', 3000), steps('2026-10-05', 3000)], '2026-10-06');
    expect(short.carriedIntoToday).toBe(-120);
    expect(short.availableToday).toBe(0);
    expect(short.allowance).toEqual({});
  });

  it('does not count a day with no entry, nor today\'s steps so far, as a shortfall', () => {
    const r = bank([steps('2026-10-04', 8500), steps('2026-10-06', 1000)], '2026-10-06'); // Monday not logged; today 1,000 so far
    expect(r.carriedIntoToday).toBe(160);
    expect(r.availableToday).toBe(160);
  });

  it('a short day only counts once it is over: the same steps on a past day take calories off, today they do not', () => {
    expect(stepNetKcal(3000, true, GOAL, 70)).toBe(-60);
    expect(stepNetKcal(0, false, GOAL, 70)).toBe(0);
    expect(stepNetKcal(8500, true, GOAL, 70)).toBe(160);
  });
});

describe('getStepBankDebtKcal', () => {
  const params = (stepLogs: StepLog[], today: string) => ({ baseAdjustment: undefined, plan: PLAN, stepLogs, foodLog: [], targetDailySteps: GOAL, weightKg: 70, today });
  it('is what the days before today owe: a day below the goal takes calories off the bank, which is shown as a debt', () => {
    expect(getStepBankDebtKcal(params([steps('2026-10-04', 2800)], '2026-10-05'))).toBe(68); // 1,700 steps short, 0.04 kcal each
  });
  it('is 0 when the days before were above the goal, or when there is nothing to owe', () => {
    expect(getStepBankDebtKcal(params([steps('2026-10-04', 6500)], '2026-10-05'))).toBe(0);
    expect(getStepBankDebtKcal(params([], '2026-10-04'))).toBe(0);
  });
  it('shrinks as today\'s steps pay it off', () => {
    expect(getStepBankDebtKcal(params([steps('2026-10-04', 2800), steps('2026-10-05', 5500)], '2026-10-05'))).toBe(28); // +40 today against 68
  });
});

describe('withStepMode', () => {
  const logs = [steps('2026-10-05', 6500), steps('2026-10-06', 3000), steps('2026-10-07', 8500)];
  const base = { mode: 'add_calories' as const, stepLogs: logs, foodLog: [] as FoodEntry[], plan: PLAN, targetDailySteps: GOAL, weightKg: 70, today: '2026-10-07' };

  it('in the calorie mode gives today the bank and past days only what they spent', () => {
    // Monday earned 80 and ate nothing: it keeps them; Tuesday walked 1,500 short (-60); Wednesday earned 160: today's target gets 80 - 60 + 160.
    expect(withStepMode(undefined, base)?.stepAllowance).toEqual({ '2026-10-07': 180 });
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
    expect(out?.stepAllowance).toEqual({ '2026-10-07': 40 }); // Tuesday's 40 kcal wait for today
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

describe('steps beyond the week\'s total, turned into calories by the user', () => {
  // The week of Sunday 2026-10-04 has a total of 7 x 4,500 = 31,500 steps.
  const WEEK = '2026-10-04';
  const params = (stepLogs: StepLog[], today: string, stepSurplus?: Record<string, 'kcal' | 'keep'>, saved?: Parameters<typeof withStepMode>[0]) =>
    withStepMode(saved, { mode: 'balance_steps', stepLogs, foodLog: [], plan: PLAN, targetDailySteps: GOAL, weightKg: 70, today, stepSurplus });

  it('measures the surplus against the whole week, counting Sunday through the day', () => {
    const logs = [steps('2026-10-04', 10000), steps('2026-10-05', 10000), steps('2026-10-06', 10000), steps('2026-10-07', 5000), steps('2026-10-03', 9999)];
    expect(getWeekStepSurplus({ stepLogs: logs, targetDailySteps: GOAL, weightKg: 70, date: '2026-10-07' })).toEqual({ weeklyTarget: 31500, walked: 35000, surplusSteps: 3500, surplusKcal: 140 });
    expect(getWeekStepSurplus({ stepLogs: logs, targetDailySteps: GOAL, weightKg: 70, date: '2026-10-06' }).surplusSteps).toBe(0); // 30,000: the total is not reached yet
  });

  it('adds nothing to the calories until the user says yes, or when they say to keep the steps', () => {
    const logs = [steps('2026-10-04', 10000), steps('2026-10-05', 10000), steps('2026-10-06', 10000), steps('2026-10-07', 5000)];
    expect(params(logs, '2026-10-07')).toBeUndefined();
    expect(params(logs, '2026-10-07', { [WEEK]: 'keep' })).toBeUndefined();
    expect(params(logs, '2026-10-07', { '2026-09-27': 'kcal' })).toBeUndefined(); // another week's answer
  });

  it('after a yes, the steps beyond the total become the day\'s calories', () => {
    const logs = [steps('2026-10-04', 10000), steps('2026-10-05', 10000), steps('2026-10-06', 10000), steps('2026-10-07', 5000)];
    expect(params(logs, '2026-10-07', { [WEEK]: 'kcal' })?.stepAllowance).toEqual({ '2026-10-07': 140 });
  });

  it('a short day never takes calories off, and the surplus a day earns waits for the next days of the week', () => {
    const logs = [steps('2026-10-04', 2000), steps('2026-10-05', 2000), steps('2026-10-06', 30000)];
    // 34,000 by Tuesday: 2,500 over = 100 kcal, carried to Wednesday (nothing eaten above the base meanwhile).
    expect(params(logs, '2026-10-07', { [WEEK]: 'kcal' })?.stepAllowance).toEqual({ '2026-10-07': 100 });
  });

  it('counts the extra walking a rebalance asked for as part of the total', () => {
    const logs = [steps('2026-10-04', 10000), steps('2026-10-05', 10000), steps('2026-10-06', 10000), steps('2026-10-07', 5000)];
    const saved = { weekStart: WEEK, steps: { boost: 1000, days: 2, fromDate: '2026-10-08' } };
    const out = params(logs, '2026-10-07', { [WEEK]: 'kcal' }, saved);
    expect(out?.stepAllowance).toEqual({ '2026-10-07': 60 }); // total 33,500: 1,500 over
    expect(out?.steps).toEqual(saved.steps);
  });

  it('is ignored in the calorie mode, where every day is measured against the goal', () => {
    const logs = [steps('2026-10-04', 10000)];
    const out = withStepMode(undefined, { mode: 'add_calories', stepLogs: logs, foodLog: [], plan: PLAN, targetDailySteps: GOAL, weightKg: 70, today: '2026-10-04', stepSurplus: { [WEEK]: 'keep' } });
    expect(out?.stepAllowance).toEqual({ '2026-10-04': 220 });
  });

  it('sanitizeStepSurplus keeps only valid weeks and choices, the latest eight', () => {
    expect(sanitizeStepSurplus({ '2026-10-04': 'kcal', nope: 'kcal', '2026-10-11': 'maybe' })).toEqual({ '2026-10-04': 'kcal' });
    expect(sanitizeStepSurplus([])).toBeNull();
    expect(sanitizeStepSurplus({})).toBeNull();
    const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`2026-0${1 + (i % 9)}-${10 + i}`, 'keep']));
    expect(Object.keys(sanitizeStepSurplus(many) ?? {}).length).toBe(8);
  });
});
