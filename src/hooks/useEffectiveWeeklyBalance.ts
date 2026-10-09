import { useMemo } from 'react';
import type { AppState, WeeklyBalanceAdjustment } from '../types/fitness';
import { getBaseStepGoal } from '../utils/stepGoalSync';
import { getStepMode, withStepMode } from '../utils/weeklySteps';
import { useToday } from './useToday';

/**
 * The week's adjustment as every calorie screen should read it: the saved rebalance choices with the step mode applied (in the calorie mode each day's steps
 * above the goal are already part of that day's target). Derived from the step history, never stored, so every screen gets the same numbers.
 */
export function useEffectiveWeeklyBalance(appState: AppState): WeeklyBalanceAdjustment | undefined {
  const today = useToday();
  const { weeklyBalance, stepLogs, profile } = appState;
  const mode = getStepMode(appState);
  const goal = getBaseStepGoal(appState);
  const weightKg = profile.metrics.weightKg;
  return useMemo(() => withStepMode(weeklyBalance, { mode, stepLogs, targetDailySteps: goal, weightKg, today }), [weeklyBalance, stepLogs, mode, goal, weightKg, today]);
}
