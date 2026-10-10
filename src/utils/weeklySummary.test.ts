import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionPlan, StepLog, WeightLog, WorkoutPlan } from '../types/fitness';
import { buildWeeklySummary } from './weeklySummary';

// 2026-10-04 is a Sunday. Target 2,400 a day, step goal 4,500, 70 kg (0.04 kcal a step).
const PLAN = { bmr: 1600, tdee: 2400, targetCalories: 2400, macros: { proteinG: 150, fatG: 70, carbsG: 300 }, calorieDeficitOrSurplus: 0 } as NutritionPlan;
const GOAL = 4500;
const meal = (date: string, calories: number, proteinG = 100): FoodEntry => ({ id: `${date}-${calories}`, date, meal: 'lunch', name: 'x', quantity: '', calories, proteinG, fatG: 0, carbsG: 0 });
const steps = (date: string, n: number): StepLog => ({ date, steps: n });
const weigh = (date: string, weightKg: number): WeightLog => ({ id: date, date, weightKg });

function summary(over: { foodLog?: FoodEntry[]; stepLogs?: StepLog[]; weightLogs?: WeightLog[]; stepMode?: 'balance_steps' | 'add_calories'; today?: string; weekDate?: string }) {
  const state = {
    foodLog: over.foodLog ?? [],
    progress: [],
    workoutPlan: { days: [], daysPerWeek: 3 } as unknown as WorkoutPlan,
    completedWorkoutDates: [],
    stepLogs: over.stepLogs ?? [],
    weightLogs: over.weightLogs ?? [],
    schedule: [],
    nutritionPlan: PLAN,
    profile: { metrics: { weightKg: 70 } } as never,
    stepGoal: GOAL,
    weeklyBalance: undefined,
    stepMode: over.stepMode,
  };
  const today = over.today ?? '2026-10-08';
  return buildWeeklySummary(state, over.weekDate ?? today, today, GOAL);
}

describe('weekly summary agrees with the rest of the app', () => {
  it('averages steps over the days that are over, a day with no entry counting as 0, and leaves today\'s partial count out', () => {
    // Thursday 8th is today. Sunday 6,000, Monday not logged, Tuesday 3,000, Wednesday 3,000; today so far only 500.
    const s = summary({ stepLogs: [steps('2026-10-04', 6000), steps('2026-10-06', 3000), steps('2026-10-07', 3000), steps('2026-10-08', 500)] });
    expect(s.steps.average).toBe(3000); // 12,000 over Sunday to Wednesday = 4 days
  });

  it('uses today only on the first day of a week, when there is nothing else yet', () => {
    expect(summary({ today: '2026-10-04', stepLogs: [steps('2026-10-04', 2000)] }).steps.average).toBe(2000);
  });

  it('averages calories and protein over the finished days, so a day that is still being eaten does not pull them down', () => {
    const s = summary({ foodLog: [meal('2026-10-04', 2400, 150), meal('2026-10-05', 2600, 130), meal('2026-10-08', 300, 20)] });
    expect(s.nutrition.daysLogged).toBe(2);
    expect(s.nutrition.avgCalories).toBe(2500);
    expect(s.nutrition.avgProteinG).toBe(140);
  });

  it('judges calories against the days\' real targets: in the calorie mode the steps above the goal are part of them', () => {
    // Sunday 8,500 steps = 4,000 above the goal = +160 kcal that the day ate (2,560 against a base of 2,400).
    const log = [meal('2026-10-04', 2560)];
    const steps8500 = [steps('2026-10-04', 8500)];
    expect(summary({ foodLog: log, stepLogs: steps8500, stepMode: 'add_calories' }).nutrition.targetCalories).toBe(2560);
    expect(summary({ foodLog: log, stepLogs: steps8500, stepMode: 'balance_steps' }).nutrition.targetCalories).toBe(2400);
  });

  it('shows the weekly average weight and its change from last week\'s average, not single weigh-ins', () => {
    const s = summary({ weightLogs: [weigh('2026-09-28', 68.0), weigh('2026-09-30', 68.4), weigh('2026-10-05', 68.8), weigh('2026-10-07', 69.2)] });
    expect(s.weight.average).toBe(69); // (68.8 + 69.2) / 2
    expect(s.weight.changeKg).toBe(0.8); // against last week's average 68.2
  });

  it('has no weight change without a previous week, and no weight at all for a week without weigh-ins', () => {
    expect(summary({ weightLogs: [weigh('2026-10-05', 68.8)] }).weight).toEqual({ average: 68.8, changeKg: null });
    expect(summary({ weightLogs: [weigh('2026-09-28', 68.0)] }).weight.average).toBeNull();
  });
});
