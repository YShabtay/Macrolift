import { describe, expect, it } from 'vitest';
import type { AppState, UserMetrics } from '../types/fitness';
import { calculateNutritionPlan } from './calculations';
import { applyStepGoal, followProfileSteps, getBaseStepGoal } from './stepGoalSync';

const METRICS: UserMetrics = {
  gender: 'male',
  age: 28,
  heightCm: 178,
  weightKg: 75,
  averageDailySteps: 4500,
  trainingDaysPerWeek: 3,
  bodyState: 'athletic',
  goal: 'gain_muscle',
  goalIntensity: 'moderate',
};

function stateWith(metrics: UserMetrics, extra: Partial<AppState> = {}): AppState {
  return {
    profile: { id: 'p', name: 'x', createdAt: '2026-01-01T00:00:00.000Z', metrics },
    nutritionPlan: calculateNutritionPlan(metrics),
    ...extra,
  } as AppState;
}

describe('getBaseStepGoal', () => {
  it('uses the goal the user set, otherwise the profile average', () => {
    expect(getBaseStepGoal(stateWith(METRICS))).toBe(4500);
    expect(getBaseStepGoal(stateWith(METRICS, { stepGoal: 9000 }))).toBe(9000);
  });
});

describe('applyStepGoal', () => {
  it('makes the dashboard goal the profile average and recalculates the calorie target from it', () => {
    const before = stateWith(METRICS);
    const after = applyStepGoal(before, 10000, 'weekly');

    expect(after.stepGoal).toBe(10000);
    expect(after.stepGoalMode).toBe('weekly');
    expect(after.profile.metrics.averageDailySteps).toBe(10000);
    // More daily steps means a higher activity level, so the maintenance and target calories rise.
    expect(after.nutritionPlan.tdee).toBeGreaterThan(before.nutritionPlan.tdee);
    expect(after.nutritionPlan.targetCalories).toBeGreaterThan(before.nutritionPlan.targetCalories);
    expect(after.nutritionPlan).toEqual(calculateNutritionPlan({ ...METRICS, averageDailySteps: 10000 }));
  });

  it('lowers the target when the goal goes down, and leaves everything else in the profile alone', () => {
    const before = stateWith({ ...METRICS, averageDailySteps: 12000 });
    const after = applyStepGoal(before, 3000, 'daily');
    expect(after.nutritionPlan.tdee).toBeLessThan(before.nutritionPlan.tdee);
    expect(after.stepGoalMode).toBe('daily');
    expect({ ...after.profile.metrics, averageDailySteps: 12000 }).toEqual(before.profile.metrics);
  });

  it('moves the calories even for a small change in steps', () => {
    const before = stateWith(METRICS); // 4,500 steps
    const after = applyStepGoal(before, 5300, 'weekly');
    expect(after.nutritionPlan.tdee).toBeGreaterThan(before.nutritionPlan.tdee);
    expect(after.nutritionPlan.targetCalories).toBeGreaterThan(before.nutritionPlan.targetCalories);
    expect(after.stepGoal).toBe(5300);
  });
});

describe('applyStepGoal limits', () => {
  it('keeps the profile average inside what the profile editor accepts', () => {
    const after = applyStepGoal(stateWith(METRICS), 80000, 'daily');
    expect(after.stepGoal).toBe(80000);
    expect(after.profile.metrics.averageDailySteps).toBe(50000);
  });
});

describe('followProfileSteps', () => {
  it('moves the dashboard goal when the profile average changed', () => {
    const before = stateWith(METRICS, { stepGoal: 10000 });
    const edited = stateWith({ ...METRICS, averageDailySteps: 6000 }, { stepGoal: 10000 });
    expect(followProfileSteps(before, edited).stepGoal).toBe(6000);
  });

  it('leaves a goal the user set alone when the average did not change', () => {
    const before = stateWith(METRICS, { stepGoal: 10000 });
    const edited = stateWith({ ...METRICS, age: 29 }, { stepGoal: 10000 });
    expect(followProfileSteps(before, edited)).toBe(edited);
  });
});
