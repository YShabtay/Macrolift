import type { AppState } from '../types/fitness';
import { calculateNutritionPlan } from './calculations';

/**
 * The daily step average the app plans around is one number, shown in two places: "ממוצע צעדים" in the profile, which sets the activity
 * level behind the calorie target, and the goal on the dashboard's steps card, which the weekly step plan and balance are built on.
 * These helpers keep them equal, so changing it in either place also moves the other and the calorie target.
 */

const MAX_PROFILE_AVERAGE_STEPS = 50000;

/** The step goal in force: the one the user set, otherwise their profile average. */
export function getBaseStepGoal(state: Pick<AppState, 'stepGoal' | 'profile'>): number {
  return state.stepGoal ?? state.profile.metrics.averageDailySteps;
}

/** Saves a new step goal from the dashboard and makes it the profile's average, recalculating the calorie and macro targets from it. */
export function applyStepGoal(prev: AppState, goal: number, mode: 'weekly' | 'daily'): AppState {
  // The profile only accepts averages up to 50,000 (the step tracker allows a higher single-day goal); stay inside that so the profile stays editable.
  const metrics = { ...prev.profile.metrics, averageDailySteps: Math.min(goal, MAX_PROFILE_AVERAGE_STEPS) };
  return {
    ...prev,
    stepGoal: goal,
    stepGoalMode: mode,
    profile: { ...prev.profile, metrics },
    nutritionPlan: calculateNutritionPlan(metrics),
  };
}

/** After a profile edit: when the average steps changed, the dashboard goal follows it (the calorie targets were already recalculated). */
export function followProfileSteps(before: AppState, after: AppState): AppState {
  const steps = after.profile.metrics.averageDailySteps;
  return steps !== before.profile.metrics.averageDailySteps ? { ...after, stepGoal: steps } : after;
}
