import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, StepLog } from '../types/fitness';
import { describeCoverage, describeExtraRoom, describeRoom, getOvershootCoverage } from './overshoot';

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

  it('stops being covered exactly where the room runs out', () => {
    const base = [meal(SUN, 2341), meal(MON, 2341)];
    const steps174 = [steps(SUN, BASE_GOAL + 4346)];
    const room = coverage([...base, meal(TODAY, 2384)], steps174).roomKcal;
    expect(coverage([...base, meal(TODAY, 2384 + room)], steps174).isCovered).toBe(true);
    expect(coverage([...base, meal(TODAY, 2384 + room + 1)], steps174).isCovered).toBe(false);
  });
});

describe('extra room beyond the target on a day still under it', () => {
  it('shows what the bonus steps leave beyond today\'s target when the week is otherwise on target', () => {
    const c = coverage([meal(SUN, 2341), meal(TODAY, 2141)], [steps(SUN, BASE_GOAL + 4346)]);
    expect(c.overshootKcal).toBe(0);
    expect(c.extraRoomKcal).toBe(174); // the rest of today (200) is eaten, the week ends level, and the steps are all spare
    expect(describeExtraRoom(c)).toContain('174');
  });

  it('is used up by an overshoot earlier in the week, and is empty without bonus steps', () => {
    expect(coverage([meal(SUN, 2641), meal(TODAY, 2141)], [steps(SUN, BASE_GOAL + 4346)]).extraRoomKcal).toBe(0);
    expect(coverage([meal(SUN, 2341), meal(TODAY, 2141)]).extraRoomKcal).toBe(0);
  });

  it('is not shown when it is small', () => {
    expect(describeExtraRoom({ ...coverage([meal(TODAY, 2141)]), extraRoomKcal: 30, bonusSteps: 800 })).toBe('');
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
