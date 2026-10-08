import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, StepLog } from '../types/fitness';
import { COVERAGE_TOLERANCE_KCAL, describeCoverage, describeRoom, getOvershootCoverage, getRebalanceDebtKcal } from './overshoot';
import { getStepCredit } from './stepCredit';

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
    expect(c.roomKcal).toBe(0);
  });

  it('is covered by bonus steps that bring the week back to balance (the case of 43 kcal over and 4,346 bonus steps), and says how much room is left', () => {
    const c = coverage([meal(SUN, 2341), meal(MON, 2341), meal(TODAY, 2384)], [steps(SUN, BASE_GOAL + 4346)]);
    expect(c.overshootKcal).toBe(43);
    expect(c.bonusSteps).toBe(4346);
    expect(c.stepsKcal).toBe(174);
    expect(c.weekBalanceKcal).toBe(43);
    expect(c.coveredBySteps).toBe(true);
    expect(c.isCovered).toBe(true);
    expect(c.roomKcal).toBe(131); // 174 kcal of steps - the 43 kcal the week is over
  });

  it('is covered by the week as a whole when the days before were under target, with the room that leaves', () => {
    const c = coverage([meal(SUN, 1500), meal(MON, 1500), meal(TODAY, 2641)]);
    expect(c.overshootKcal).toBe(300);
    expect(c.weekBalanceKcal).toBeLessThan(0);
    expect(c.coveredByWeek).toBe(true);
    expect(c.isCovered).toBe(true);
    expect(c.roomKcal).toBe(-c.weekBalanceKcal);
  });

  it('is covered by steps and the week together when neither is enough alone', () => {
    // Week +100 over (today +300, Monday -200) and 150 kcal of bonus steps: together the week is back 50 kcal under.
    const c = coverage([meal(MON, 2141), meal(TODAY, 2641)], [steps(MON, BASE_GOAL + 3750)]);
    expect(c.overshootKcal).toBe(300);
    expect(c.stepsKcal).toBe(150);
    expect(c.weekBalanceKcal).toBe(100);
    expect(c.isCovered).toBe(true);
    expect(c.roomKcal).toBe(50);
  });

  it('is not covered when the week is over and the steps do not make up the difference', () => {
    const c = coverage([meal(SUN, 2641), meal(MON, 2641), meal(TODAY, 2641)], [steps(SUN, BASE_GOAL + 1000)]);
    expect(c.overshootKcal).toBe(300);
    expect(c.isCovered).toBe(false);
    expect(c.roomKcal).toBe(0);
  });

  it('does not let the same steps cover today after earlier days already used them (no double counting)', () => {
    // Sunday and Monday were each 300 over; 174 kcal of steps cannot also cover today's 43.
    const c = coverage([meal(SUN, 2641), meal(MON, 2641), meal(TODAY, 2384)], [steps(SUN, BASE_GOAL + 4346)]);
    expect(c.overshootKcal).toBe(43);
    expect(c.weekBalanceKcal).toBe(643);
    expect(c.isCovered).toBe(false);
  });

  it('does not count a single logged overshoot as covered just because other days are missing', () => {
    expect(coverage([meal(TODAY, 2800)]).isCovered).toBe(false);
  });

  it('counts steps walked above the goal today as well', () => {
    const c = coverage([meal(TODAY, 2400)], [steps(TODAY, BASE_GOAL + 2000)]);
    expect(c.overshootKcal).toBe(59);
    expect(c.coveredBySteps).toBe(true);
    expect(c.roomKcal).toBe(21); // 80 kcal of steps - 59
  });

  it('stops being covered where the room plus the estimate tolerance runs out', () => {
    const base = [meal(SUN, 2341), meal(MON, 2341)];
    const steps174 = [steps(SUN, BASE_GOAL + 4346)];
    const room = coverage([...base, meal(TODAY, 2384)], steps174).roomKcal;
    expect(coverage([...base, meal(TODAY, 2384 + room + COVERAGE_TOLERANCE_KCAL)], steps174).isCovered).toBe(true);
    expect(coverage([...base, meal(TODAY, 2384 + room + COVERAGE_TOLERANCE_KCAL + 1)], steps174).isCovered).toBe(false);
  });
});

describe('describeCoverage and describeRoom', () => {
  it('names the step bonus when it is what brings the week back to balance', () => {
    const c = coverage([meal(SUN, 2341), meal(MON, 2341), meal(TODAY, 2384)], [steps(SUN, BASE_GOAL + 4346)]);
    expect(describeCoverage(c)).toContain('4,346');
    expect(describeRoom(c)).toContain('131');
  });

  it('says the week is under its target when no steps are needed, and gives nothing when not covered', () => {
    expect(describeCoverage(coverage([meal(SUN, 1500), meal(MON, 1500), meal(TODAY, 2641)]))).toContain('מתחת ליעד המצטבר');
    expect(describeRoom(coverage([meal(TODAY, 2800)]))).toBe('');
  });
});

describe('getOvershootCoverage judged as of a past day', () => {
  // A real week: Sunday-Wednesday eaten against a 2,412 target, goal 4,500 steps. Wednesday ran 278 kcal over.
  const plan = { ...PLAN, targetCalories: 2412 } as NutritionPlan;
  const log = [meal('2026-10-04', 2385), meal('2026-10-05', 2329), meal('2026-10-06', 2384), meal('2026-10-07', 2690)];
  const stepLogs = [steps('2026-10-04', 8846), steps('2026-10-05', 3818), steps('2026-10-06', 5821), steps('2026-10-07', 2344)];
  const asOf = (today: string) => getOvershootCoverage({ foodLog: log, plan, adjustment: undefined, stepLogs, baseStepGoal: 4500, today });

  it('still reads Wednesday as covered after midnight, when it is looked at as yesterday', () => {
    const c = asOf('2026-10-07');
    expect(c.overshootKcal).toBe(278);
    expect(c.isCovered).toBe(true);
    expect(c.roomKcal).toBeGreaterThan(0);
  });

  it('has no overshoot on the new day before anything is eaten', () => {
    const c = asOf('2026-10-08');
    expect(c.overshootKcal).toBe(0);
    expect(c.isCovered).toBe(false);
  });
});


describe('step credit is signed: fewer steps than the goal count against the week once the day is over', () => {
  const GOAL = 4500;
  const logs = [steps('2026-10-04', 8846), steps('2026-10-05', 3818), steps('2026-10-06', 5821), steps('2026-10-07', 2344)];
  const credit = (asOf: string, realToday?: string) => getStepCredit({ stepLogs: logs, baseGoal: GOAL, adjustment: undefined, asOf, realToday });

  it('counts only the surplus of a day still in progress, but its shortfall once the day is finished', () => {
    const during = credit('2026-10-07'); // Wednesday itself: 2,344 steps may still grow
    expect(during.shortfallSteps).toBe(682); // only Monday is finished and short
    const after = credit('2026-10-08'); // Thursday: Wednesday is finished
    expect(after.shortfallSteps).toBe(682 + 2156);
    expect(after.bonusSteps).toBe(4346 + 1321);
    expect(after.netKcal).toBe(Math.round(((4346 + 1321 - 682 - 2156) * 40) / 1000));
  });

  it('looking back at Wednesday from Thursday uses the finished day', () => {
    expect(credit('2026-10-07', '2026-10-08')).toEqual(credit('2026-10-08'));
  });

  it('skips a day with no step entry instead of counting it as zero', () => {
    const c = getStepCredit({ stepLogs: [steps('2026-10-04', 6000)], baseGoal: GOAL, adjustment: undefined, asOf: '2026-10-08' });
    expect(c.shortfallSteps).toBe(0);
    expect(c.bonusSteps).toBe(1500);
  });
});

describe('getRebalanceDebtKcal', () => {
  // The week the rebalance screen used to call "fully covered" while the food tab showed an overshoot: Sunday-Thursday against 2,412, goal 4,500 steps.
  const plan = { ...PLAN, targetCalories: 2412 } as NutritionPlan;
  const log = [meal('2026-10-04', 2385), meal('2026-10-05', 2329), meal('2026-10-06', 2384), meal('2026-10-07', 2690), meal('2026-10-08', 2630)];
  const stepLogs = [steps('2026-10-04', 8846), steps('2026-10-05', 3818), steps('2026-10-06', 5821), steps('2026-10-07', 2344), steps('2026-10-08', 5758)];
  const c = getOvershootCoverage({ foodLog: log, plan, adjustment: undefined, stepLogs, baseStepGoal: 4500, today: '2026-10-08' });

  it('is not covered, and what is left is the week after the net step credit, not today alone minus the bonus steps', () => {
    expect(c.overshootKcal).toBe(218);
    expect(c.weekBalanceKcal).toBe(358);
    expect(c.stepsKcal).toBe(163); // 6,925 steps above the goal minus 2,838 short on finished days
    expect(c.isCovered).toBe(false);
    expect(getRebalanceDebtKcal(c)).toBe(195);
  });
  it('never asks for more than today\'s overshoot, and is zero when the week is in credit', () => {
    expect(getRebalanceDebtKcal({ ...c, weekBalanceKcal: 900 })).toBe(218);
    expect(getRebalanceDebtKcal({ ...c, weekBalanceKcal: 100 })).toBe(0);
  });
});
