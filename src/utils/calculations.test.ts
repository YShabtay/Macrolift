import { describe, expect, it } from 'vitest';
import type { UserMetrics } from '../types/fitness';
import { calculateBMR, calculateMacros, calculateNutritionPlan, calculatePreciseNutrition, getActivityMultiplier } from './calculations';

describe('getActivityMultiplier', () => {
  it('steps through the step bands at their exact boundaries', () => {
    expect(getActivityMultiplier(0, 0)).toBe(1.2);
    expect(getActivityMultiplier(3999, 0)).toBe(1.2);
    expect(getActivityMultiplier(4000, 0)).toBe(1.35);
    expect(getActivityMultiplier(6499, 0)).toBe(1.35);
    expect(getActivityMultiplier(6500, 0)).toBe(1.45);
    expect(getActivityMultiplier(9499, 0)).toBe(1.45);
    expect(getActivityMultiplier(9500, 0)).toBe(1.55);
  });

  it('adds 0.05 only for a heavy training week (4+ sessions)', () => {
    expect(getActivityMultiplier(6500, 3)).toBe(1.45);
    expect(getActivityMultiplier(6500, 4)).toBeCloseTo(1.5, 10);
    expect(getActivityMultiplier(9500, 6)).toBeCloseTo(1.6, 10);
  });
});

describe('calculateBMR (Mifflin-St Jeor)', () => {
  const base = { weightKg: 80, heightCm: 180, age: 30 };

  it('matches the published formula for men and women', () => {
    expect(calculateBMR({ ...base, gender: 'male' } as UserMetrics)).toBe(1780);
    expect(calculateBMR({ ...base, gender: 'female' } as UserMetrics)).toBe(1614);
  });

  it('puts the male/female gap at exactly 166 kcal for identical measurements', () => {
    const male = calculateBMR({ ...base, gender: 'male' } as UserMetrics);
    const female = calculateBMR({ ...base, gender: 'female' } as UserMetrics);
    expect(male - female).toBe(166);
  });
});

describe('calculateMacros', () => {
  it('uses 2.0 g/kg protein and 0.9 g/kg fat for men, the rest as carbs', () => {
    expect(calculateMacros(2800, 80, 'male')).toEqual({ proteinG: 160, fatG: 72, carbsG: 378 });
  });

  it('uses 1.8 g/kg protein and 1.0 g/kg fat for women', () => {
    expect(calculateMacros(2000, 60, 'female')).toEqual({ proteinG: 108, fatG: 60, carbsG: 257 });
  });

  it('never returns negative carbs when calories are too low for the protein and fat minimums', () => {
    expect(calculateMacros(1000, 80, 'male').carbsG).toBe(0);
  });

  it('adds back up to the target calories (within rounding)', () => {
    const { proteinG, fatG, carbsG } = calculateMacros(2650, 72, 'male');
    expect(Math.abs(proteinG * 4 + fatG * 9 + carbsG * 4 - 2650)).toBeLessThanOrEqual(4);
  });
});

describe('calculatePreciseNutrition', () => {
  const man = { gender: 'male', weightKg: 80, heightCm: 180, age: 30, dailyStepGoal: 8000, workoutDaysPerWeek: 3 } as const;

  it('derives TDEE from BMR x the activity multiplier', () => {
    const result = calculatePreciseNutrition({ ...man, goal: 'maintenance' });
    expect(result.bmr).toBe(1780);
    expect(result.tdee).toBe(2581); // 1780 x 1.45
    expect(result.targetCalories).toBe(2581);
  });

  it('applies the goal offsets: lean bulk +220, bulk +400, cut -400, aggressive cut -550', () => {
    const target = (goal: Parameters<typeof calculatePreciseNutrition>[0]['goal']) => calculatePreciseNutrition({ ...man, goal }).targetCalories;
    expect(target('lean_bulk')).toBe(2581 + 220);
    expect(target('bulk')).toBe(2581 + 400);
    expect(target('cut')).toBe(2581 - 400);
    expect(target('aggressive_cut')).toBe(2581 - 550);
  });

  it('never cuts below BMR, however deep the deficit', () => {
    const smallWoman = { gender: 'female', weightKg: 50, heightCm: 160, age: 40, dailyStepGoal: 2000, workoutDaysPerWeek: 2 } as const;
    const bmr = 1139;
    expect(calculatePreciseNutrition({ ...smallWoman, goal: 'maintenance' }).tdee).toBe(1367);
    expect(calculatePreciseNutrition({ ...smallWoman, goal: 'cut' }).targetCalories).toBe(bmr);
    expect(calculatePreciseNutrition({ ...smallWoman, goal: 'aggressive_cut' }).targetCalories).toBe(bmr);
  });

  it('recomp is a ~5% deficit from TDEE', () => {
    expect(calculatePreciseNutrition({ ...man, goal: 'recomp' }).targetCalories).toBe(Math.round(2581 * 0.95));
  });

  it('returns macros whose calories match the target', () => {
    const result = calculatePreciseNutrition({ ...man, goal: 'lean_bulk' });
    const fromMacros = result.proteinGrams * 4 + result.fatGrams * 9 + result.carbGrams * 4;
    expect(Math.abs(fromMacros - result.targetCalories)).toBeLessThanOrEqual(4);
  });
});

describe('calculateNutritionPlan', () => {
  const metrics: UserMetrics = {
    gender: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    averageDailySteps: 8000,
    trainingDaysPerWeek: 3,
    bodyState: 'athletic',
    goal: 'maintain',
  };

  it('reports the surplus/deficit relative to TDEE for each goal', () => {
    expect(calculateNutritionPlan({ ...metrics, goal: 'maintain' }).calorieDeficitOrSurplus).toBe(0);
    expect(calculateNutritionPlan({ ...metrics, goal: 'lose_weight' }).calorieDeficitOrSurplus).toBe(-400);
    expect(calculateNutritionPlan({ ...metrics, goal: 'gain_muscle' }).calorieDeficitOrSurplus).toBe(220);
  });

  it('gains faster at the aggressive intensity (+400 instead of +220)', () => {
    expect(calculateNutritionPlan({ ...metrics, goal: 'gain_muscle', goalIntensity: 'moderate' }).calorieDeficitOrSurplus).toBe(220);
    expect(calculateNutritionPlan({ ...metrics, goal: 'gain_muscle', goalIntensity: 'aggressive' }).calorieDeficitOrSurplus).toBe(400);
  });

  it('keeps bmr, tdee and target consistent', () => {
    const plan = calculateNutritionPlan({ ...metrics, goal: 'gain_muscle' });
    expect(plan.tdee).toBeGreaterThan(plan.bmr);
    expect(plan.targetCalories).toBe(plan.tdee + plan.calorieDeficitOrSurplus);
  });
});
