import { describe, expect, it } from 'vitest';
import type { UserMetrics } from '../types/fitness';
import { calculateBMR, calculateMacros, calculateNutritionPlan, calculatePreciseNutrition, estimateEnergyExpenditure } from './calculations';
import { estimateStepCalories } from './stepsCalculations';

describe('estimateEnergyExpenditure', () => {
  const base = { bmr: 1700, weightKg: 70, dailySteps: 8000, trainingDaysPerWeek: 3 };

  it('adds daily life (BMR x 1.4), walking above the baseline (0.04 kcal per step at 70 kg) and the weekly training', () => {
    const e = estimateEnergyExpenditure(base);
    expect(e.baseKcal).toBe(2380);
    expect(e.stepsKcal).toBe(160); // (8,000 - 4,000) x 0.04
    expect(e.trainingKcal).toBe(107); // 3 x 250 / 7 at 70 kg
    expect(e.tdee).toBe(2647);
  });

  it('keeps every free-living case inside the FAO/WHO activity levels (PAL 1.40-2.40)', () => {
    for (const dailySteps of [0, 2000, 4000, 6000, 8000, 10000, 15000]) {
      for (const trainingDaysPerWeek of [0, 3, 6]) {
        const e = estimateEnergyExpenditure({ ...base, dailySteps, trainingDaysPerWeek });
        const pal = e.tdee / base.bmr;
        expect(pal, `${dailySteps} steps, ${trainingDaysPerWeek} sessions`).toBeGreaterThanOrEqual(1.4);
        expect(pal, `${dailySteps} steps, ${trainingDaysPerWeek} sessions`).toBeLessThanOrEqual(2.4);
      }
    }
  });

  it('counts only the steps beyond the ordinary walking the baseline already includes', () => {
    expect(estimateEnergyExpenditure({ ...base, dailySteps: 0 }).stepsKcal).toBe(0);
    expect(estimateEnergyExpenditure({ ...base, dailySteps: 4000 }).stepsKcal).toBe(0);
    expect(estimateEnergyExpenditure({ ...base, dailySteps: 4001 }).tdee).toBeGreaterThanOrEqual(estimateEnergyExpenditure({ ...base, dailySteps: 4000 }).tdee);
  });

  it('moves with every step above the baseline, including small changes (4,500 -> 5,300 steps)', () => {
    const low = estimateEnergyExpenditure({ ...base, dailySteps: 4500 }).tdee;
    const high = estimateEnergyExpenditure({ ...base, dailySteps: 5300 }).tdee;
    expect(high - low).toBe(32); // 800 steps x 0.04
  });

  it('values 1,000 steps the same as the step tracker does, and scales walking with body weight', () => {
    const at70 = estimateEnergyExpenditure({ ...base, dailySteps: 5000 }).stepsKcal - estimateEnergyExpenditure({ ...base, dailySteps: 4000 }).stepsKcal;
    expect(at70).toBe(estimateStepCalories(1000, 70));
    expect(estimateEnergyExpenditure({ ...base, weightKg: 105 }).stepsKcal).toBe(240); // 1.5 x the 70 kg cost of 4,000 steps
  });

  it('counts each training session, scales it with body weight, and caps absurd step counts', () => {
    expect(estimateEnergyExpenditure({ ...base, trainingDaysPerWeek: 6 }).trainingKcal).toBe(214);
    expect(estimateEnergyExpenditure({ ...base, trainingDaysPerWeek: 0 }).trainingKcal).toBe(0);
    expect(estimateEnergyExpenditure({ ...base, weightKg: 105, trainingDaysPerWeek: 6 }).trainingKcal).toBe(321);
    expect(estimateEnergyExpenditure({ ...base, dailySteps: 90000 }).stepsKcal).toBe(estimateEnergyExpenditure({ ...base, dailySteps: 30000 }).stepsKcal);
  });

  it('never goes below everyday life', () => {
    expect(estimateEnergyExpenditure({ ...base, dailySteps: 0, trainingDaysPerWeek: 0 }).tdee).toBe(2380);
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

  it('derives TDEE from BMR: daily life, walking and training', () => {
    const result = calculatePreciseNutrition({ ...man, goal: 'maintenance' });
    expect(result.bmr).toBe(1780);
    expect(result.tdee).toBe(2797); // 1780 x 1.4 + 4,000 steps above the baseline at 80 kg (183) + 3 sessions at 80 kg (122)
    expect(result.formulaTdee).toBe(2797);
    expect(result.targetCalories).toBe(2797);
  });

  it('starts a surplus goal from the LOW end of the maintenance range, so a too-high estimate cannot push anyone into a bigger surplus', () => {
    // tdee 2,797 with an 8% band: low 2,573, high 3,021.
    const lean = calculatePreciseNutrition({ ...man, goal: 'lean_bulk' });
    expect(lean.targetCalories).toBe(2573 + 220);
    expect(lean.targetMin).toBe(2573 + 220);
    expect(lean.targetMax).toBe(2797 + 220); // the top of the range is the surplus on the central estimate
    expect(lean.intendedOffsetKcal).toBe(220);
    const bulk = calculatePreciseNutrition({ ...man, goal: 'bulk' });
    expect(bulk.targetCalories).toBe(2573 + 400);
    expect(bulk.targetMax).toBe(2797 + 400);
  });

  it('starts a deficit goal from the HIGH end, so a too-low estimate cannot push anyone into a deeper deficit', () => {
    const cut = calculatePreciseNutrition({ ...man, goal: 'cut' });
    expect(cut.targetCalories).toBe(3021 - 400);
    expect(cut.targetMax).toBe(3021 - 400);
    expect(cut.targetMin).toBe(2797 - 400); // the deepest it goes is the deficit on the central estimate
    expect(cut.intendedOffsetKcal).toBe(-400);
    const hard = calculatePreciseNutrition({ ...man, goal: 'aggressive_cut' });
    expect(hard.targetCalories).toBe(3021 - 550);
    expect(hard.targetMin).toBe(2797 - 550);
  });

  it('keeps maintenance and recomp centred, with the range around them', () => {
    const keep = calculatePreciseNutrition({ ...man, goal: 'maintenance' });
    expect(keep.targetCalories).toBe(2797);
    expect(keep.targetMin).toBe(Math.round(2797 * 0.96));
    expect(keep.targetMax).toBe(Math.round(2797 * 1.04));
    const recomp = calculatePreciseNutrition({ ...man, goal: 'recomp' });
    expect(recomp.targetCalories).toBe(Math.round(2797 * 0.95));
    expect(recomp.targetMin).toBeLessThan(recomp.targetCalories);
    expect(recomp.targetMax).toBeGreaterThan(recomp.targetCalories);
  });

  it('puts the start inside the range, and every range between the safe end and the central estimate, for every goal', () => {
    for (const goal of ['lean_bulk', 'bulk', 'maintenance', 'cut', 'aggressive_cut', 'recomp'] as const) {
      const r = calculatePreciseNutrition({ ...man, goal });
      expect(r.targetMin, goal).toBeLessThanOrEqual(r.targetCalories);
      expect(r.targetCalories, goal).toBeLessThanOrEqual(r.targetMax);
    }
  });

  it('never cuts below BMR, however deep the deficit, at the start or anywhere in the range', () => {
    const smallWoman = { gender: 'female', weightKg: 50, heightCm: 160, age: 40, dailyStepGoal: 2000, workoutDaysPerWeek: 2 } as const;
    const bmr = 1139;
    expect(calculatePreciseNutrition({ ...smallWoman, goal: 'maintenance' }).tdee).toBe(1646);
    const cut = calculatePreciseNutrition({ ...smallWoman, goal: 'cut' });
    expect(cut.targetCalories).toBe(1778 - 400); // high end 1,778 - 400, still above BMR
    expect(cut.targetMin).toBe(1646 - 400);
    const hard = calculatePreciseNutrition({ ...smallWoman, goal: 'aggressive_cut' });
    expect(hard.targetCalories).toBe(1778 - 550);
    expect(hard.targetMin).toBe(bmr); // 1,646 - 550 would be below it
  });

  it('narrows the range once the TDEE has been corrected against the user\'s own weight trend', () => {
    const plain = calculatePreciseNutrition({ ...man, goal: 'lean_bulk' });
    const calibrated = calculatePreciseNutrition({ ...man, goal: 'lean_bulk', tdeeAdjustmentKcal: 100 });
    expect(calibrated.targetMax - calibrated.targetMin).toBeLessThan(plain.targetMax - plain.targetMin);
  });

  it('adds the personal calibration to the TDEE before the goal offset, and keeps the formula value separate', () => {
    const calibrated = calculatePreciseNutrition({ ...man, goal: 'lean_bulk', tdeeAdjustmentKcal: -150 });
    expect(calibrated.formulaTdee).toBe(2797);
    expect(calibrated.tdee).toBe(2647);
    expect(calibrated.targetMax).toBe(2647 + 220);
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

  it('gives a man of 69 kg, 170 cm, 29 with 4,500 steps and 3 sessions a TDEE of about 2,380 and a lean-bulk range of 2,412 to 2,603', () => {
    const plan = calculateNutritionPlan({ ...metrics, age: 29, heightCm: 170, weightKg: 69, averageDailySteps: 4500, goal: 'gain_muscle', goalIntensity: 'moderate' });
    expect(plan.bmr).toBe(1613);
    expect(plan.tdee).toBe(2383);
    expect(plan.targetCalories).toBe(2412); // starts at the low end: maintenance as low as 2,192, plus 220
    expect(plan.targetMin).toBe(2412);
    expect(plan.targetMax).toBe(2603); // the central estimate plus 220
    expect(plan.intendedOffsetKcal).toBe(220);
  });

  it('keeps the intended surplus or deficit separate from where in the range the start sits', () => {
    expect(calculateNutritionPlan({ ...metrics, goal: 'maintain' }).intendedOffsetKcal).toBe(0);
    expect(calculateNutritionPlan({ ...metrics, goal: 'lose_weight' }).intendedOffsetKcal).toBe(-400);
    expect(calculateNutritionPlan({ ...metrics, goal: 'gain_muscle' }).intendedOffsetKcal).toBe(220);
  });

  it('gains faster at the aggressive intensity (+400 instead of +220)', () => {
    expect(calculateNutritionPlan({ ...metrics, goal: 'gain_muscle', goalIntensity: 'moderate' }).intendedOffsetKcal).toBe(220);
    expect(calculateNutritionPlan({ ...metrics, goal: 'gain_muscle', goalIntensity: 'aggressive' }).intendedOffsetKcal).toBe(400);
  });

  it('keeps bmr, tdee and target consistent', () => {
    const plan = calculateNutritionPlan({ ...metrics, goal: 'gain_muscle' });
    expect(plan.tdee).toBeGreaterThan(plan.bmr);
    expect(plan.targetCalories).toBe(plan.tdee + plan.calorieDeficitOrSurplus);
  });
});
