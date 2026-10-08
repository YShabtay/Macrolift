import { describe, expect, it } from 'vitest';
import type { AppState, FoodEntry, UserMetrics, WeightLog } from '../types/fitness';
import { calculateNutritionPlan } from './calculations';
import { MAX_TARGET_ADJUSTMENT_KCAL, applyTargetAdjustment, checkTarget, expectedWeeklyChange, getCheckStart } from './targetCheck';

const TODAY = '2026-10-29';
const SINCE = '2026-10-01';

function isoBefore(daysBack: number): string {
  return new Date(Date.UTC(2026, 9, 29) - daysBack * 86_400_000).toISOString().slice(0, 10);
}

/** A weigh-in every other day for three weeks along a straight line of `kgPerWeek`, starting at 69 kg. */
function weighIns(kgPerWeek: number, noise: (back: number) => number = () => 0): WeightLog[] {
  const logs: WeightLog[] = [];
  for (let back = 21; back >= 1; back -= 2) logs.push({ id: `w${back}`, date: isoBefore(back), weightKg: 69 + (kgPerWeek / 7) * (21 - back) + noise(back) } as WeightLog);
  return logs;
}

const meal = (back: number, calories: number): FoodEntry => ({ id: `f${back}`, date: isoBefore(back), meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 });

function check(weightLogs: WeightLog[], over: Partial<Parameters<typeof checkTarget>[0]> = {}) {
  return checkTarget({ weightLogs, foodLog: [], goal: 'gain_muscle', intensity: 'moderate', weightKg: 69, targetCalories: 2412, since: SINCE, today: TODAY, ...over });
}

describe('expectedWeeklyChange', () => {
  it('asks for 0.25-0.5% a week for a lean bulk, a faster pace for an aggressive one, and 0.5-1% loss for a cut', () => {
    expect(expectedWeeklyChange('gain_muscle', 'moderate')).toEqual({ min: 0.0025, max: 0.005 });
    expect(expectedWeeklyChange('gain_muscle', 'aggressive').min).toBe(0.005);
    expect(expectedWeeklyChange('lose_weight', undefined)).toEqual({ min: -0.01, max: -0.005 });
  });
});

describe('checkTarget', () => {
  it('waits for about two weeks of weigh-ins instead of guessing', () => {
    expect(check(weighIns(0).slice(-4)).status).toBe('collecting');
    expect(check(weighIns(0), { since: '2026-10-25' }).status).toBe('collecting'); // the target changed four days ago
  });

  it('suggests adding calories when a bulk is not gaining (a flat weekly average)', () => {
    const r = check(weighIns(0));
    expect(r.status).toBe('ready');
    if (r.status !== 'ready') return;
    expect(r.verdict).toBe('add');
    expect(r.suggestedDeltaKcal).toBe(200); // the middle of 0.17-0.35 kg a week is about 0.26, worth about 200 kcal a day
    expect(r.expectedKgPerWeek).toEqual({ min: 0.17, max: 0.35 });
  });

  it('suggests adding calories for a bulk that is losing weight, capped at 300', () => {
    const r = check(weighIns(-0.3));
    expect(r.status === 'ready' && r.verdict).toBe('add');
    expect(r.status === 'ready' && r.suggestedDeltaKcal).toBe(300);
  });

  it('leaves a bulk alone when the pace is inside the range', () => {
    const r = check(weighIns(0.25));
    expect(r.status === 'ready' && r.verdict).toBe('on-track');
    expect(r.status === 'ready' && r.suggestedDeltaKcal).toBe(0);
  });

  it('suggests eating less when the weight climbs too fast', () => {
    const r = check(weighIns(0.8));
    expect(r.status === 'ready' && r.verdict).toBe('reduce');
    expect(r.status === 'ready' && r.suggestedDeltaKcal).toBe(-300);
  });

  it('does not act on a noisy trend that is only slightly outside the range', () => {
    const r = check(weighIns(0.1, (back) => (back % 4 === 1 ? 1.4 : -1.4)));
    expect(r.status === 'ready' && r.verdict).toBe('unclear');
    expect(r.status === 'ready' && r.suggestedDeltaKcal).toBe(0);
  });

  it('for a cut, suggests eating less when the weight is not coming down, and more when it falls too fast', () => {
    const stuck = check(weighIns(-0.05), { goal: 'lose_weight', intensity: undefined, targetCalories: 2174 });
    expect(stuck.status === 'ready' && stuck.verdict).toBe('reduce');
    expect(stuck.status === 'ready' && stuck.suggestedDeltaKcal).toBeLessThan(0);
    const tooFast = check(weighIns(-1.2), { goal: 'lose_weight', intensity: undefined, targetCalories: 2174 });
    expect(tooFast.status === 'ready' && tooFast.verdict).toBe('add');
  });

  it('puts a flat weight down to not eating the target when the logged food is well below it', () => {
    const food = Array.from({ length: 10 }, (_, i) => meal(i + 1, 2000));
    const r = check(weighIns(0), { foodLog: food });
    expect(r.status === 'ready' && r.verdict).toBe('reach-target');
    expect(r.status === 'ready' && r.suggestedDeltaKcal).toBe(0);
    expect(r.status === 'ready' && r.avgIntake).toBe(2000);
  });

  it('puts a fast gain down to eating above the target when the logged food is well above it', () => {
    const food = Array.from({ length: 10 }, (_, i) => meal(i + 1, 2900));
    const r = check(weighIns(0.8), { foodLog: food });
    expect(r.status === 'ready' && r.verdict).toBe('hold-target');
  });

  it('still suggests a change when the logged food matches the target, or too few days were logged to judge', () => {
    expect(check(weighIns(0), { foodLog: Array.from({ length: 10 }, (_, i) => meal(i + 1, 2400)) }).status === 'ready').toBe(true);
    const few = check(weighIns(0), { foodLog: [meal(1, 1500), meal(2, 1500)] });
    expect(few.status === 'ready' && few.verdict).toBe('add');
    expect(few.status === 'ready' && few.avgIntake).toBeNull();
  });
});

describe('applyTargetAdjustment', () => {
  const metrics: UserMetrics = {
    gender: 'male',
    age: 29,
    heightCm: 170,
    weightKg: 69,
    averageDailySteps: 4500,
    trainingDaysPerWeek: 3,
    bodyState: 'athletic',
    goal: 'gain_muscle',
    goalIntensity: 'moderate',
  };
  const state = { profile: { id: 'p', name: 'x', createdAt: '2026-10-02T10:19:53.425Z', metrics }, nutritionPlan: calculateNutritionPlan(metrics) } as AppState;

  it('moves the target and both ends of the range together, and stamps the day the check restarts from', () => {
    const after = applyTargetAdjustment(state, 200, TODAY);
    expect(after.profile.metrics.targetAdjustmentKcal).toBe(200);
    expect(after.profile.metrics.targetAdjustmentDate).toBe(TODAY);
    expect(after.nutritionPlan.targetCalories).toBe(state.nutritionPlan.targetCalories + 200);
    expect(after.nutritionPlan.targetMin).toBe((state.nutritionPlan.targetMin ?? 0) + 200);
    expect(after.nutritionPlan.targetMax).toBe((state.nutritionPlan.targetMax ?? 0) + 200);
    expect(after.nutritionPlan.tdee).toBe(state.nutritionPlan.tdee); // the estimate itself is untouched
    expect(calculateNutritionPlan(after.profile.metrics)).toEqual(after.nutritionPlan);
  });

  it('adds to an earlier correction, and removes it when the two cancel out', () => {
    const once = applyTargetAdjustment(state, 150, '2026-10-15');
    const twice = applyTargetAdjustment(once, 100, TODAY);
    expect(twice.profile.metrics.targetAdjustmentKcal).toBe(250);
    const undone = applyTargetAdjustment(twice, -250, TODAY);
    expect(undone.profile.metrics.targetAdjustmentKcal).toBeUndefined();
    expect(undone.nutritionPlan.targetCalories).toBe(state.nutritionPlan.targetCalories);
  });

  it('a manual set to an absolute amount (applied as the difference) lands exactly there and restarts the weight-trend check', () => {
    const at150 = applyTargetAdjustment(state, 150, '2026-10-01');
    const to50 = applyTargetAdjustment(at150, 50 - (at150.profile.metrics.targetAdjustmentKcal ?? 0), TODAY);
    expect(to50.profile.metrics.targetAdjustmentKcal).toBe(50);
    expect(getCheckStart(to50.profile.metrics, state.profile.createdAt)).toBe(TODAY);
    const reset = applyTargetAdjustment(to50, 0 - (to50.profile.metrics.targetAdjustmentKcal ?? 0), TODAY);
    expect(reset.nutritionPlan).toEqual(state.nutritionPlan);
  });

  it('keeps a correction within the limit', () => {
    expect(applyTargetAdjustment(state, 5000, TODAY).profile.metrics.targetAdjustmentKcal).toBe(MAX_TARGET_ADJUSTMENT_KCAL);
  });

  it('never takes a plan below BMR', () => {
    const cut = { ...state, profile: { ...state.profile, metrics: { ...metrics, goal: 'lose_weight' as const } } } as AppState;
    const after = applyTargetAdjustment(cut, -600, TODAY);
    expect(after.nutritionPlan.targetCalories).toBeGreaterThanOrEqual(after.nutritionPlan.bmr);
  });
});

describe('getCheckStart', () => {
  it('counts from the last accepted correction, otherwise from the day the profile was made', () => {
    expect(getCheckStart({ targetAdjustmentDate: '2026-10-15' }, '2026-10-02T10:19:53.425Z')).toBe('2026-10-15');
    expect(getCheckStart({}, '2026-10-02T10:19:53.425Z')).toBe('2026-10-02');
  });
});
