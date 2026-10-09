import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, StepLog } from '../types/fitness';
import { getWeeklyStepsPlan } from './weeklySteps';
import { getOpenRebalanceDebtKcal, getOvershootCoverage, getRebalanceDebtKcal, shouldOfferRebalance } from './overshoot';
import { getWeeklyCalorieBudget } from './calorieBudget';
import { getStepCredit } from './stepCredit';
import { applyRebalanceChoice } from './rebalanceChoice';
import { buildRebalanceOptions, getDailyTargets, getEffectiveStepGoal, getStepBoostBreakdown, KCAL_PER_1000_STEPS } from './weeklyBalance';
import { chooseStepAllowance } from './stepAllowance';

/**
 * One story, checked on every screen's numbers at once: a weekly step average of 4,500, a week of walking well above it, one day that went 400 kcal
 * over, and then the choices the user can make. The point is that the screens never disagree, and that no step or calorie is counted twice.
 */
const GOAL = 4500;
const PLAN = { bmr: 1600, tdee: 2400, targetCalories: 2400, macros: { proteinG: 150, fatG: 70, carbsG: 300 }, calorieDeficitOrSurplus: 0 } as NutritionPlan;
const meal = (date: string, calories: number): FoodEntry => ({ id: date, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });
const DAYS = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'] as const; // Sunday to Thursday
const FOOD = [meal(DAYS[0], 2400), meal(DAYS[1], 2400), meal(DAYS[2], 2400), meal(DAYS[3], 2800), meal(DAYS[4], 2400)]; // Wednesday is 400 over
const STEPS: StepLog[] = DAYS.map((date) => ({ date, steps: 5500 })); // an average of 5,500 against 4,500
const FRIDAY = '2026-10-09';
const kcal = (steps: number) => (steps * KCAL_PER_1000_STEPS) / 1000;

const coverage = (adjustment?: Parameters<typeof getOvershootCoverage>[0]['adjustment'], stepLogs = STEPS) =>
  getOvershootCoverage({ foodLog: FOOD, plan: PLAN, adjustment, stepLogs, baseStepGoal: GOAL, today: FRIDAY });

describe('walking above the weekly average', () => {
  const plan = getWeeklyStepsPlan(GOAL, undefined, STEPS, FRIDAY);

  it('shows the average so far and what is left to walk on each remaining day', () => {
    expect(plan.averageBefore).toBe(5500);
    expect(plan.daysLeft).toBe(2);
    expect(plan.paceToday).toBe((31500 - 27500) / 2); // 2,000: the user can walk less and still finish on 4,500
    expect(plan.takeAllToday).toBe(0); // 4,000 are left, and tomorrow's plain 4,500 alone covers them: today can be a rest day
  });

  it('is worth the same calories on the step screen and on the nutrition screens', () => {
    const surplusSteps = plan.balanceBefore; // 5,000 above the average
    expect(surplusSteps).toBe(5000);
    expect(coverage().stepsKcal).toBe(kcal(surplusSteps)); // 200 kcal
    expect(getStepCredit({ stepLogs: STEPS, baseGoal: GOAL, adjustment: undefined, asOf: FRIDAY }).netKcal).toBe(200);
  });

  it('adds that credit to what the weekly budget recommends for today, shared over the days left', () => {
    const noCredit = getWeeklyCalorieBudget(FOOD, PLAN, undefined, FRIDAY, FRIDAY, 0).pace!;
    const withCredit = getWeeklyCalorieBudget(FOOD, PLAN, undefined, FRIDAY, FRIDAY, 200).pace!;
    expect(withCredit.kcal - noCredit.kcal).toBe(200 / 2);
  });

  it('turns into eating more on the day the user picks, with nothing counted twice', () => {
    const adjustment = chooseStepAllowance({ adjustment: undefined, stepLogs: STEPS, baseStepGoal: GOAL, today: FRIDAY, days: 1 });
    expect(getDailyTargets(PLAN, adjustment, FRIDAY).calories).toBe(2400 + 200);
    expect(coverage(adjustment).stepsKcal).toBe(0); // the credit now sits in Friday's target, so the step screen no longer offers it a second time
  });
});

describe('a 400 kcal overshoot', () => {
  it('is netted with the spare steps automatically: only what the steps do not cover is left to make up', () => {
    const c = coverage();
    expect(c.weekOverSoFarKcal).toBe(400);
    expect(c.stepsKcal).toBe(200);
    expect(getRebalanceDebtKcal(c)).toBe(200);
    expect(shouldOfferRebalance(c)).toBe(true);
  });

  it('chosen as "walk more": the extra steps equal the debt, the spare steps are not subtracted a second time, and the debt counts as planned', () => {
    const debt = getRebalanceDebtKcal(coverage());
    const options = buildRebalanceOptions(debt, PLAN, FRIDAY);
    expect(options.netStepsNeeded).toBe(5000); // 200 kcal of steps
    const adjustment = applyRebalanceChoice({ weekStart: '2026-10-04' }, { kind: 'steps', boost: options.stepsSpread.storedPerDay, days: 1, fromDate: '2026-10-10' });
    const tomorrow = getStepBoostBreakdown(GOAL, adjustment, '2026-10-10', STEPS);
    expect(tomorrow.credited).toBe(0);
    expect(tomorrow.net).toBe(tomorrow.gross); // the boost is read as stored
    expect(getEffectiveStepGoal(GOAL, adjustment, '2026-10-10', STEPS)).toBe(GOAL + tomorrow.gross);

    const plan = getWeeklyStepsPlan(GOAL, adjustment, STEPS, '2026-10-10');
    expect(plan.rebalanceExtraSteps).toBe(tomorrow.gross); // the step card shows the same extra the goal uses
    const c = coverage(adjustment);
    expect(c.plannedCompensationKcal).toBe(Math.round(kcal(tomorrow.gross)));
    expect(getOpenRebalanceDebtKcal(c)).toBe(0); // nothing left over, and the screen can still be opened to change it
    expect(shouldOfferRebalance(c)).toBe(true);
  });

  it('chosen as "lower the next days": the targets drop by exactly the debt, and the plan counts as made up', () => {
    const debt = getRebalanceDebtKcal(coverage());
    const options = buildRebalanceOptions(debt, PLAN, FRIDAY);
    const adjustment = applyRebalanceChoice({ weekStart: '2026-10-04' }, { kind: 'taper', reductionKcal: options.taper.perDayKcal, fromDate: options.taper.fromDate });
    const cut = 2400 - getDailyTargets(PLAN, adjustment, '2026-10-10').calories; // only Saturday is left after Friday
    expect(cut).toBe(debt);
    expect(getOpenRebalanceDebtKcal(coverage(adjustment))).toBe(0);
  });

  it('"carry on as usual" puts everything back', () => {
    const planned = applyRebalanceChoice({ weekStart: '2026-10-04' }, { kind: 'taper', reductionKcal: 200, fromDate: '2026-10-10' });
    const cleared = applyRebalanceChoice(planned, { kind: 'keep' });
    expect(getOpenRebalanceDebtKcal(coverage(cleared))).toBe(getRebalanceDebtKcal(coverage()));
  });

  it('is covered entirely when the spare steps are enough, and the screen then stops asking', () => {
    const moreSteps = STEPS.map((s) => ({ ...s, steps: 7500 })); // 3,000 a day above: 15,000 steps = 600 kcal against the 400
    const c = coverage(undefined, moreSteps);
    expect(getRebalanceDebtKcal(c)).toBe(0);
    expect(shouldOfferRebalance(c)).toBe(false);
  });
});
