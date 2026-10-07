import { describe, expect, it } from 'vitest';
import type { NutritionPlan } from '../types/fitness';
import { describeRangeShort, getCalorieRange } from './calorieRange';

const plan = (over: Partial<NutritionPlan>): NutritionPlan => ({ bmr: 1613, tdee: 2383, targetCalories: 2412, macros: { proteinG: 138, fatG: 62, carbsG: 300 }, calorieDeficitOrSurplus: 29, ...over });

describe('getCalorieRange', () => {
  it('starts a surplus plan at the low end, a deficit plan at the high end and maintenance in the middle', () => {
    expect(getCalorieRange(plan({ targetMin: 2412, targetMax: 2603, intendedOffsetKcal: 220 }))?.start).toBe('low');
    expect(getCalorieRange(plan({ targetMin: 1983, targetMax: 2174, intendedOffsetKcal: -400 }))?.start).toBe('high');
    expect(getCalorieRange(plan({ targetMin: 2290, targetMax: 2480, intendedOffsetKcal: 0 }))?.start).toBe('middle');
  });

  it('has no range for a plan stored without one, or a degenerate one', () => {
    expect(getCalorieRange(plan({}))).toBeNull();
    expect(getCalorieRange(plan({ targetMin: 2400, targetMax: 2400 }))).toBeNull();
  });
});

describe('describeRangeShort', () => {
  it('names the range and the end to start from', () => {
    const text = describeRangeShort({ min: 2412, max: 2603, start: 'low' });
    expect(text).toContain('2,412-2,603');
    expect(text).toContain('הקצה הנמוך');
  });
});
