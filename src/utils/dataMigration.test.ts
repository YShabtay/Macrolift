import { describe, expect, it } from 'vitest';
import type { AppState } from '../types/fitness';
import { NUTRITION_FORMULA_VERSION } from './calculations';
import { SCHEMA_VERSION, sanitizeAppState } from './dataMigration';

function sanitized(raw: unknown): AppState {
  const state = sanitizeAppState(raw);
  expect(state).not.toBeNull();
  return state as AppState;
}

describe('sanitizeAppState', () => {
  it('rejects values that are not an object', () => {
    expect(sanitizeAppState(null)).toBeNull();
    expect(sanitizeAppState('x')).toBeNull();
    expect(sanitizeAppState(42)).toBeNull();
    expect(sanitizeAppState([])).toBeNull();
  });

  it('turns an empty object into a complete, usable state', () => {
    const state = sanitized({});
    expect(Array.isArray(state.weightLogs)).toBe(true);
    expect(Array.isArray(state.foodLog)).toBe(true);
    expect(Array.isArray(state.stepLogs)).toBe(true);
    expect(Array.isArray(state.progress)).toBe(true);
    expect(state.nutritionPlan.targetCalories).toBeGreaterThan(0);
    expect(state.workoutPlan.days.length).toBeGreaterThan(0);
  });

  it('stamps the current schema version', () => {
    expect((sanitized({}) as AppState & { schemaVersion: number }).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('drops only the unusable weigh-ins and keeps the rest', () => {
    const state = sanitized({
      weightLogs: [
        { id: 'a', date: '2026-10-01', weightKg: 70 },
        { id: 'b', date: 'not-a-date', weightKg: 70 },
        { id: 'c', date: '2026-10-02', weightKg: -5 },
        { id: 'd', date: '2026-10-03', weightKg: 0 },
        { id: 'e', date: '2026-10-04', weightKg: 71.5 },
        null,
        'junk',
      ],
    });
    expect(state.weightLogs.map((w) => w.id)).toEqual(['a', 'e']);
  });

  it('tolerates lists that are missing or the wrong type', () => {
    const state = sanitized({ weightLogs: 'oops', foodLog: { not: 'a list' }, stepLogs: null, progress: 5 });
    expect(state.weightLogs).toEqual([]);
    expect(state.foodLog).toEqual([]);
    expect(state.stepLogs).toEqual([]);
    expect(state.progress).toEqual([]);
  });

  it('removes the water data of the retired water tracker', () => {
    expect(sanitized({ waterLogs: [{ date: '2026-10-01', ml: 500 }] })).not.toHaveProperty('waterLogs');
  });

  it('is idempotent: sanitizing its own output changes nothing', () => {
    const once = sanitized({
      weightLogs: [{ id: 'a', date: '2026-10-01', weightKg: 70 }, { date: 'bad', weightKg: 1 }],
      foodLog: [{ id: 'f', date: '2026-10-01', meal: 'lunch', name: 'x', quantity: '1', calories: 100, proteinG: 1, fatG: 1, carbsG: 1 }, { junk: true }],
      stepGoal: 9000.4,
      completedWorkoutDates: ['2026-10-01', 'nope'],
    });
    expect(sanitizeAppState(once)).toEqual(once);
  });

  it('keeps valid history through the clean-up', () => {
    const state = sanitized({
      foodLog: [{ id: 'f', date: '2026-10-01', meal: 'lunch', name: 'אורז', quantity: '100 גרם', calories: 130, proteinG: 3, fatG: 0, carbsG: 28 }],
      completedWorkoutDates: ['2026-10-01', 'nope'],
      stepGoal: 9000.4,
    });
    expect(state.foodLog).toHaveLength(1);
    expect(state.foodLog[0]).toMatchObject({ name: 'אורז', calories: 130 });
    expect(state.completedWorkoutDates).toEqual(['2026-10-01']);
    expect(state.stepGoal).toBe(9000);
  });

  describe('the TDEE model version', () => {
    const profile = {
      id: 'p',
      name: 'x',
      createdAt: '2026-10-02T10:00:00.000Z',
      metrics: { gender: 'male', age: 29, heightCm: 170, weightKg: 69, averageDailySteps: 4500, trainingDaysPerWeek: 3, bodyState: 'athletic', goal: 'gain_muscle', goalIntensity: 'moderate' },
    };
    const olderPlan = { bmr: 1613, tdee: 2218, targetCalories: 2438, macros: { proteinG: 138, fatG: 62, carbsG: 332 }, calorieDeficitOrSurplus: 220 };

    it('recalculates a plan stored by an older model, once, and stamps the current version', () => {
      const state = sanitized({ profile, nutritionPlan: olderPlan });
      expect(state.nutritionFormulaVersion).toBe(NUTRITION_FORMULA_VERSION);
      expect(state.nutritionPlan.tdee).toBe(2383);
      expect(state.nutritionPlan.targetCalories).toBe(2603);
    });

    it('keeps a plan that is already on the current model, even one the user adjusted since', () => {
      const first = sanitized({ profile, nutritionPlan: olderPlan });
      const adjusted = { ...first, nutritionPlan: { ...first.nutritionPlan, targetCalories: 2500 } };
      expect(sanitized(adjusted).nutritionPlan.targetCalories).toBe(2500);
    });
  });
});
