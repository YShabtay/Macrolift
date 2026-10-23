import { describe, expect, it } from 'vitest';
import type { AppState, FoodEntry, NutritionPlan } from '../types/fitness';
import { getOvershootCoverage } from './overshoot';
import { HISTORY_BEGINNING, attachTargetHistory, getTargetOnDate, sanitizeTargetHistory, trackTargetHistory } from './targetHistory';
import { getDailyTargets } from './weeklyBalance';

const PLAN = { bmr: 1600, tdee: 2400, targetCalories: 2500, macros: { proteinG: 150, fatG: 70, carbsG: 300 }, calorieDeficitOrSurplus: 100 } as NutritionPlan;
const stateOf = (plan: NutritionPlan, extra: Partial<AppState> = {}, metrics: object = {}) => ({ nutritionPlan: plan, profile: { metrics }, ...extra }) as unknown as AppState;
const meal = (date: string, calories: number): FoodEntry => ({ id: `${date}-${calories}`, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });

describe('getTargetOnDate', () => {
  const plan = { ...PLAN, targetHistory: [{ from: HISTORY_BEGINNING, calories: 2400 }, { from: '2026-10-23', calories: 2500 }] };
  it('is the target the day had, from the date a change took effect', () => {
    expect(getTargetOnDate(plan, '2026-10-22')).toBe(2400);
    expect(getTargetOnDate(plan, '2026-10-23')).toBe(2500);
    expect(getTargetOnDate(plan, '2026-11-01')).toBe(2500);
  });
  it('is the plan\'s target when there is no history', () => {
    expect(getTargetOnDate(PLAN, '2026-10-01')).toBe(2500);
  });
});

describe('getDailyTargets with a history', () => {
  const plan = { ...PLAN, targetHistory: [{ from: HISTORY_BEGINNING, calories: 2400 }, { from: '2026-10-23', calories: 2500 }] };
  it('gives an earlier day the target it had, the difference sitting in carbs', () => {
    const before = getDailyTargets(plan, undefined, '2026-10-22');
    expect(before.calories).toBe(2400);
    expect(before.macros.carbsG).toBe(275);
    expect(before.macros.proteinG).toBe(150);
    expect(getDailyTargets(plan, undefined, '2026-10-23').calories).toBe(2500);
  });
  it('does not change how the days before a raise are judged', () => {
    // Sunday to Thursday ate 2,500 each (100 over the 2,400 they had); the target was raised to 2,500 on Friday.
    const food = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((d) => meal(d, 2500));
    const withHistory = getOvershootCoverage({ foodLog: food, plan, adjustment: undefined, today: '2026-10-23' });
    const withoutHistory = getOvershootCoverage({ foodLog: food, plan: PLAN, adjustment: undefined, today: '2026-10-23' });
    expect(withHistory.weekOverSoFarKcal).toBe(500);
    expect(withoutHistory.weekOverSoFarKcal).toBe(0);
  });
});

describe('trackTargetHistory', () => {
  it('starts a history with the current target', () => {
    const next = trackTargetHistory(stateOf(PLAN), '2026-10-23');
    expect(next.targetHistory).toEqual([{ from: HISTORY_BEGINNING, calories: 2500 }]);
  });
  it('for an account from before the history, reads the earlier target from the accepted correction', () => {
    const state = stateOf(PLAN, {}, { targetAdjustmentKcal: 100, targetAdjustmentDate: '2026-10-23' });
    expect(trackTargetHistory(state, '2026-10-24').targetHistory).toEqual([
      { from: HISTORY_BEGINNING, calories: 2400 },
      { from: '2026-10-23', calories: 2500 },
    ]);
  });
  it('adds an entry when the target changes, and replaces today\'s entry when it changes again', () => {
    const first = trackTargetHistory(stateOf(PLAN), '2026-10-20');
    const raised = trackTargetHistory({ ...first, nutritionPlan: { ...PLAN, targetCalories: 2600 } }, '2026-10-23');
    expect(raised.targetHistory).toEqual([{ from: HISTORY_BEGINNING, calories: 2500 }, { from: '2026-10-23', calories: 2600 }]);
    const again = trackTargetHistory({ ...raised, nutritionPlan: { ...PLAN, targetCalories: 2650 } }, '2026-10-23');
    expect(again.targetHistory).toEqual([{ from: HISTORY_BEGINNING, calories: 2500 }, { from: '2026-10-23', calories: 2650 }]);
  });
  it('returns the same object when nothing changed', () => {
    const first = trackTargetHistory(stateOf(PLAN), '2026-10-20');
    expect(trackTargetHistory(first, '2026-10-21')).toBe(first);
  });
});

describe('attachTargetHistory and sanitizeTargetHistory', () => {
  it('puts the history on the plan only when there is more than the one entry', () => {
    const single = stateOf(PLAN, { targetHistory: [{ from: HISTORY_BEGINNING, calories: 2500 }] });
    expect(attachTargetHistory(single)).toBe(single);
    const two = stateOf(PLAN, { targetHistory: [{ from: HISTORY_BEGINNING, calories: 2400 }, { from: '2026-10-23', calories: 2500 }] });
    expect(attachTargetHistory(two).nutritionPlan.targetHistory).toHaveLength(2);
  });
  it('keeps only valid entries in date order', () => {
    expect(sanitizeTargetHistory([{ from: '2026-10-23', calories: 2500.4 }, { from: 'x', calories: 1 }, { from: '2026-10-01', calories: 2400 }, { from: '2026-10-05', calories: -1 }, null])).toEqual([
      { from: '2026-10-01', calories: 2400 },
      { from: '2026-10-23', calories: 2500 },
    ]);
    expect(sanitizeTargetHistory([])).toBeNull();
    expect(sanitizeTargetHistory('nope')).toBeNull();
  });
});
