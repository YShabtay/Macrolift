import { describe, expect, it } from 'vitest';
import type { FoodEntry, WeightLog } from '../types/fitness';
import type { AppState, UserMetrics } from '../types/fitness';
import { calculateNutritionPlan } from './calculations';
import { MAX_TDEE_ADJUSTMENT_KCAL, applyTdeeAdjustment, observeTdee, suggestAdjustment, type CalibrationObservation } from './calibration';

const TODAY = '2026-10-29';

function isoBefore(daysBack: number): string {
  const d = new Date(Date.UTC(2026, 9, 29) - daysBack * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function food(daysBack: number, calories: number): FoodEntry {
  return { id: `f${daysBack}-${calories}`, date: isoBefore(daysBack), meal: 'lunch', name: 'x', quantity: '', calories, proteinG: 0, fatG: 0, carbsG: 0 };
}

function weight(daysBack: number, weightKg: number): WeightLog {
  return { id: `w${daysBack}`, date: isoBefore(daysBack), weightKg } as WeightLog;
}

/** Four weeks of eating `intake` per day and a weigh-in every other day on a straight line gaining `kgPerWeek`. */
function fourWeeks(intake: number, kgPerWeek: number, noise: (i: number) => number = () => 0) {
  const foodLog: FoodEntry[] = [];
  const weightLogs: WeightLog[] = [];
  for (let back = 28; back >= 1; back--) {
    foodLog.push(food(back, intake));
    if (back % 2 === 0) weightLogs.push(weight(back, 80 + (kgPerWeek / 7) * (28 - back) + noise(back)));
  }
  return { foodLog, weightLogs };
}

const ready = (o: ReturnType<typeof observeTdee>): CalibrationObservation => {
  if (o.status !== 'ready') throw new Error('expected a measurement');
  return o;
};

describe('observeTdee', () => {
  it('works out what the body spends: intake minus the energy in the weight change', () => {
    const gaining = ready(observeTdee(...Object.values(fourWeeks(2800, 0.4)) as [FoodEntry[], WeightLog[]], TODAY));
    expect(gaining.slopeKgPerWeek).toBeCloseTo(0.4, 2);
    expect(gaining.observedTdee).toBeGreaterThan(2480);
    expect(gaining.observedTdee).toBeLessThan(2490); // 2,800 - 0.4 kg/week x 5,500 / 7: a gain is part lean tissue, so a kilo holds less than fat does
    expect(gaining.avgIntake).toBe(2800);

    const losing = ready(observeTdee(...Object.values(fourWeeks(2000, -0.5)) as [FoodEntry[], WeightLog[]], TODAY));
    expect(losing.observedTdee).toBeGreaterThan(2545);
    expect(losing.observedTdee).toBeLessThan(2555); // 2,000 + 0.5 kg/week x 7,700 / 7
  });

  it('values a kilo gained lower than a kilo lost, so a bulk is not read as burning too little', () => {
    const gain = ready(observeTdee(...Object.values(fourWeeks(2800, 0.4)) as [FoodEntry[], WeightLog[]], TODAY)).observedTdee;
    const asIfFat = 2800 - (0.4 / 7) * 7700;
    expect(gain - asIfFat).toBeGreaterThan(100);
  });

  it('adds doubt about what the weight change is made of, even when the weigh-ins sit on a perfect line', () => {
    const o = ready(observeTdee(...Object.values(fourWeeks(2800, 0.4)) as [FoodEntry[], WeightLog[]], TODAY));
    expect(o.uncertaintyKcal).toBeGreaterThan(70);
    expect(o.uncertaintyKcal).toBeLessThan(100); // 0.4 kg/week x 1,500 kcal/kg / 7
  });

  it('reads a stable weight as eating at maintenance, and a falling weight as spending more than eaten', () => {
    const flat = ready(observeTdee(...Object.values(fourWeeks(2500, 0)) as [FoodEntry[], WeightLog[]], TODAY));
    expect(flat.observedTdee).toBeCloseTo(2500, -1);
  });

  it('is less certain when the weigh-ins scatter', () => {
    const calm = ready(observeTdee(...Object.values(fourWeeks(2800, 0.3)) as [FoodEntry[], WeightLog[]], TODAY));
    const noisy = fourWeeks(2800, 0.3, (back) => (back % 4 === 0 ? 0.9 : -0.9));
    expect(ready(observeTdee(noisy.foodLog, noisy.weightLogs, TODAY)).uncertaintyKcal).toBeGreaterThan(calm.uncertaintyKcal + 100);
  });

  it('asks for more data instead of guessing when the log is thin', () => {
    const { foodLog, weightLogs } = fourWeeks(2800, 0.4);
    const fewFoodDays = observeTdee(foodLog.filter((f) => Number(f.date.slice(-2)) % 3 === 0), weightLogs, TODAY);
    expect(fewFoodDays.status).toBe('collecting');
    const fewWeighIns = observeTdee(foodLog, weightLogs.slice(0, 5), TODAY);
    expect(fewWeighIns.status).toBe('collecting');
    expect(observeTdee([], [], TODAY)).toMatchObject({ status: 'collecting', loggedDays: 0, weighIns: 0 });
  });

  it('needs the weigh-ins to cover at least two weeks', () => {
    const { foodLog } = fourWeeks(2800, 0.4);
    const bunched = Array.from({ length: 10 }, (_, i) => weight(1 + (i % 5), 80));
    expect(observeTdee(foodLog, bunched, TODAY).status).toBe('collecting');
  });

  it('skips days that were only partly logged, and ignores today and anything older than four weeks', () => {
    const { foodLog, weightLogs } = fourWeeks(2800, 0.4);
    const extras = [food(0, 300), food(40, 9000)]; // today (incomplete) and a day older than the window
    const o = ready(observeTdee([...foodLog, ...extras], weightLogs, TODAY));
    expect(o.loggedDays).toBe(28);
    expect(o.avgIntake).toBe(2800);
    const partial = ready(observeTdee([...foodLog.filter((f) => f.date !== isoBefore(3)), food(3, 400)], weightLogs, TODAY));
    expect(partial.loggedDays).toBe(27);
  });
});

describe('suggestAdjustment', () => {
  const observation = (observedTdee: number, uncertaintyKcal: number): CalibrationObservation => ({
    status: 'ready',
    observedTdee,
    avgIntake: 2800,
    slopeKgPerWeek: 0.3,
    uncertaintyKcal,
    loggedDays: 26,
    weighIns: 14,
  });

  it('moves most of the way to a clean measurement, rounded to 25 kcal', () => {
    const s = suggestAdjustment(observation(2360, 0), 2500, 0);
    expect(s.rawGap).toBe(-140);
    expect(s.trust).toBeCloseTo(0.86, 2);
    expect(s.suggestedAdjustment).toBe(-125);
    expect(s.worthSuggesting).toBe(true);
  });

  it('trusts a noisy trend much less than a clean one', () => {
    const clean = suggestAdjustment(observation(2100, 50), 2500, 0);
    const noisy = suggestAdjustment(observation(2100, 400), 2500, 0);
    expect(Math.abs(noisy.suggestedAdjustment)).toBeLessThan(Math.abs(clean.suggestedAdjustment) / 2);
    expect(noisy.trust).toBeLessThan(clean.trust);
  });

  it('does not bother the user over a gap that is too small to matter', () => {
    expect(suggestAdjustment(observation(2530, 100), 2500, 0).worthSuggesting).toBe(false);
  });

  it('compares with the correction already applied', () => {
    const already = suggestAdjustment(observation(2360, 0), 2500, -125);
    expect(already.change).toBe(0);
    expect(already.worthSuggesting).toBe(false);
    expect(suggestAdjustment(observation(2360, 0), 2500, 100).change).toBe(-225);
  });

  it('never suggests more than the limit', () => {
    expect(suggestAdjustment(observation(5000, 0), 2500, 0).suggestedAdjustment).toBe(MAX_TDEE_ADJUSTMENT_KCAL);
    expect(suggestAdjustment(observation(500, 0), 2500, 0).suggestedAdjustment).toBe(-MAX_TDEE_ADJUSTMENT_KCAL);
  });
});

describe('applyTdeeAdjustment', () => {
  const metrics: UserMetrics = {
    gender: 'male',
    age: 28,
    heightCm: 178,
    weightKg: 75,
    averageDailySteps: 6000,
    trainingDaysPerWeek: 3,
    bodyState: 'athletic',
    goal: 'gain_muscle',
    goalIntensity: 'moderate',
  };
  const state = { profile: { id: 'p', name: 'x', createdAt: '2026-01-01', metrics }, nutritionPlan: calculateNutritionPlan(metrics) } as AppState;

  it('shifts the TDEE and the target by the adjustment, and keeps it on the profile for later recalculations', () => {
    const after = applyTdeeAdjustment(state, -150);
    expect(after.profile.metrics.tdeeAdjustmentKcal).toBe(-150);
    expect(after.nutritionPlan.tdee).toBe(state.nutritionPlan.tdee - 150);
    expect(after.nutritionPlan.targetCalories).toBeLessThan(state.nutritionPlan.targetCalories);
    // Corrected against the user's own data, the estimate is trusted more: the range tightens.
    expect((after.nutritionPlan.targetMax ?? 0) - (after.nutritionPlan.targetMin ?? 0)).toBeLessThan(
      (state.nutritionPlan.targetMax ?? 0) - (state.nutritionPlan.targetMin ?? 0),
    );
    expect(calculateNutritionPlan(after.profile.metrics)).toEqual(after.nutritionPlan);
  });

  it('removes the correction when set back to zero, restoring the formula', () => {
    const back = applyTdeeAdjustment(applyTdeeAdjustment(state, 200), 0);
    expect(back.profile.metrics.tdeeAdjustmentKcal).toBeUndefined();
    expect(back.nutritionPlan).toEqual(state.nutritionPlan);
  });

  it('clamps to the limit', () => {
    expect(applyTdeeAdjustment(state, 5000).profile.metrics.tdeeAdjustmentKcal).toBe(MAX_TDEE_ADJUSTMENT_KCAL);
  });
});
