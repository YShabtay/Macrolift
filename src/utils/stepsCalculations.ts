import type { StepLog } from '../types/fitness';

export const DEFAULT_STEP_GOAL = 10000;
export const MAX_STEPS_PER_DAY = 100000;

export function getStepsForDate(stepLogs: StepLog[], date: string): number {
  return stepLogs.find((s) => s.date === date)?.steps ?? 0;
}

/**
 * Rough estimate of calories burned from walking `steps` steps, scaled by body weight.
 * Based on the common approximation of ~0.04 kcal/step for a 70kg adult (average stride).
 */
export function estimateStepCalories(steps: number, weightKg: number): number {
  const kcalPerStepAt70kg = 0.04;
  return Math.round(steps * kcalPerStepAt70kg * (weightKg / 70));
}
