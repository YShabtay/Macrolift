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
  withStepMode(base, { mode, stepLogs: STEPS, foodLog: FOOD, plan: PLAN, targetDailySteps: GOAL, weightKg: WEIGHT, today: FRIDAY });
const coverageFor = (adjustment: ReturnType<typeof adjustmentFor>) => getOvershootCoverage({ foodLog: FOOD, plan: PLAN, adjustment, today: FRIDAY });

describe('mode "balance steps" (the default): walking changes only what the days left need', () => {
  const adjustment = adjustmentFor('balance_steps');

  it('shows the average so far and a lower goal for Friday and Saturday, even on a Friday morning with nothing entered yet', () => {
    const plan = getWeeklyStepsPlan(GOAL, STEPS, FRIDAY);
    expect(plan.averageBefore).toBe(5500);
    expect(plan.daysRemaining).toBe(2);
    expect(plan.targetForTodayAndRemaining).toBe((31500 - 27500) / 2); // 2,000 a day
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

  it('rolls the bank forward: unspent step calories wait, are spent on the day that eats above the base, and what is left reaches today', () => {
    // 1,000 steps above the goal at 70 kg = 40 kcal a day. Sunday to Tuesday ate the base only, so 120 waited; Wednesday ate 400 above and spent 160.
    expect(getDailyTargets(PLAN, adjustment, DAYS[0]).calories).toBe(2400);
    expect(getDailyTargets(PLAN, adjustment, DAYS[3]).calories).toBe(2400 + 160);
    expect(getDailyTargets(PLAN, adjustment, DAYS[4]).calories).toBe(2400); // Thursday ate the base: its 40 kcal went to the 240 the week was over by
    // The week is over, so spare step calories pay that first. Nothing is left for Friday's target.
    expect(getDailyTargets(PLAN, adjustment, FRIDAY).calories).toBe(2400);
    expect(getDailyTargets(PLAN, adjustment, FRIDAY).allowanceKcal).toBe(0);
  });

  it('keeps the step goal for the days left exactly as set', () => {
    // The plan still computes a share, but the screen shows only the goal in this mode; the goal itself never moves.
    expect(getWeeklyStepsPlan(GOAL, STEPS, FRIDAY).targetDailySteps).toBe(GOAL);
  });

  it('the overshoot shrinks by the calories the steps added, once, and the budget card agrees', () => {
    const c = coverageFor(adjustment);
    // Wednesday 2,800 against a target of 2,560 (the bank it spent) is +240 and the other days ate the base; Thursday's 40 spare kcal went to that overshoot.
    expect(c.stepsAppliedKcal).toBe(40);
    expect(c.unspentBankKcal).toBe(0);
    expect(c.weekOverSoFarKcal).toBe(240 - 40);
    expect(getRebalanceDebtKcal(c)).toBe(200);
    const pace = getWeeklyCalorieBudget(FOOD, PLAN, adjustment, FRIDAY, FRIDAY).pace!;
    expect(pace.stepBonusKcal).toBe(0); // nothing was added to today's target: the spare calories paid the overshoot
    expect(pace.target).toBe(2400);
  });

  const withToday = (todaySteps: number, foodLog = FOOD, extraEaten = 0) => {
    const food = extraEaten > 0 ? [...foodLog, meal(FRIDAY, extraEaten)] : foodLog;
    const adj = withStepMode(undefined, { mode: 'add_calories', stepLogs: [...STEPS, { date: FRIDAY, steps: todaySteps }], foodLog: food, plan: PLAN, targetDailySteps: GOAL, weightKg: WEIGHT, today: FRIDAY });
    return { adj, coverage: getOvershootCoverage({ foodLog: food, plan: PLAN, adjustment: adj, today: FRIDAY }) };
  };

  it('spare step calories pay the week\'s overshoot first; only what is left over becomes room to eat today', () => {
    // The week is over by 200 after Thursday. Friday's 5,000 steps above the goal are 200 kcal: all of it cancels the overshoot, none is added to today.
    const exact = withToday(9500);
    expect(getDailyTargets(PLAN, exact.adj, FRIDAY).calories).toBe(2400);
    expect(exact.coverage.weekOverSoFarKcal).toBe(0);
    // 8,000 steps above the goal are 320: 200 cancel the overshoot, the other 120 are today's room, on top of the base target.
    const more = withToday(12500);
    expect(getDailyTargets(PLAN, more.adj, FRIDAY).calories).toBe(2400 + 120);
    expect(more.coverage.stepsAppliedKcal).toBe(40 + 200);
  });

  it('with no overshoot to cancel, the whole bank is room to eat today, on top of what today\'s steps earn', () => {
    const calm = [meal(DAYS[0], 2400), meal(DAYS[1], 2400), meal(DAYS[2], 2400), meal(DAYS[3], 2400), meal(DAYS[4], 2400)];
    const { adj, coverage } = withToday(9500, calm); // Sunday to Thursday's 200 kcal wait, and Friday adds 200
    expect(getDailyTargets(PLAN, adj, FRIDAY).calories).toBe(2400 + 400);
    expect(coverage.stepsAppliedKcal).toBe(0);
    expect(getDailyTargets(PLAN, adj, '2026-10-10').calories).toBe(2400); // Saturday is untouched until it is its turn
  });

  it('a spare calorie is used once: it cancels the overshoot, or it is room, not both', () => {
    const { adj } = withToday(12500);
    const allowance = getDailyTargets(PLAN, adj, FRIDAY).allowanceKcal;
    const week = getWeeklyCalorieBudget(FOOD, PLAN, adj, FRIDAY, FRIDAY);
    // Everything the steps earned this week: 5 days x 40 + Friday's 320 = 520. Cancelled 240, room 120, and Wednesday used 160 before the overshoot existed.
    expect(allowance + (adj?.stepAppliedToOvershoot ?? 0) + 160).toBe(520);
    expect(week.weeklyTarget).toBe(7 * 2400 + 160 + allowance + (adj?.stepAppliedToOvershoot ?? 0));
  });

  it('walking more today lowers the week\'s overshoot, and eating the room it leaves gives the credit back', () => {
    expect(withToday(0).coverage.weekOverSoFarKcal).toBe(200);
    expect(withToday(9500).coverage.weekOverSoFarKcal).toBe(0); // 200 of walking cancel the 200
    const room = withToday(12500); // 120 of room, not eaten yet: it counts as saved for now
    expect(room.coverage.unspentBankKcal).toBe(120);
    expect(room.coverage.weekOverSoFarKcal).toBe(-120);
    expect(withToday(12500, FOOD, 2500).coverage.weekOverSoFarKcal).toBe(-20); // 100 of the room eaten
    expect(withToday(12500, FOOD, 2520).coverage.weekOverSoFarKcal).toBe(0); // all of it eaten: the week is level
    expect(withToday(12500, FOOD, 2640).coverage.weekOverSoFarKcal).toBe(120); // beyond the room: over again
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
    expect(getWeeklyStepsPlan(GOAL, STEPS, FRIDAY).targetForTodayAndRemaining).toBe(2000); // the step side only reads the steps in either mode
  });
});
