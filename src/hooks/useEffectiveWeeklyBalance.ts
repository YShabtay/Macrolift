import { useMemo } from 'react';
import type { AppState, WeeklyBalanceAdjustment } from '../types/fitness';
import { getBaseStepGoal } from '../utils/stepGoalSync';
import { getStepMode, withStepMode } from '../utils/weeklySteps';
import { getWeekEnd, getWeekStart } from '../utils/weightCalculations';
import { useToday } from './useToday';

/**
 * The week's adjustment as every calorie screen should read it: the saved rebalance choices with the step mode applied (in the calorie mode each day's steps
 * above the goal are already part of that day's target). Derived from the step history, never stored, so every screen gets the same numbers.
 */
export function useEffectiveWeeklyBalance(appState: AppState): WeeklyBalanceAdjustment | undefined {
  const today = useToday();
  const { weeklyBalance, stepLogs, foodLog, nutritionPlan, profile } = appState;
  const mode = getStepMode(appState);
  const goal = getBaseStepGoal(appState);
  const weightKg = profile.metrics.weightKg;
  return useMemo(() => withStepMode(weeklyBalance, { mode, stepLogs, foodLog, plan: nutritionPlan, targetDailySteps: goal, weightKg, today }), [weeklyBalance, stepLogs, foodLog, nutritionPlan, mode, goal, weightKg, today]);
}

/**
 * The adjustment to read for any date, not only for the current week. A saved rebalance (and so the effective adjustment above) only exists for the current
 * week, so a day of an earlier week read through it lost its step calories: its target dropped back to the base and the week looked over by what the steps had
 * already covered. For an earlier week the step calories are derived again from the history: `'day'` as that day stood (what a screen of that day should read),
 * `'week'` as the whole week ended (the weekly budget and the week strip). Rebalance choices of an earlier week are not kept.
 */
export function useAdjustmentForDate(appState: AppState): (date: string, scope: 'day' | 'week') => WeeklyBalanceAdjustment | undefined {
  const today = useToday();
  const current = useEffectiveWeeklyBalance(appState);
  const { stepLogs, foodLog, nutritionPlan, profile } = appState;
  const mode = getStepMode(appState);
  const goal = getBaseStepGoal(appState);
  const weightKg = profile.metrics.weightKg;
  return useMemo(
    () => (date, scope) => {
      if (getWeekStart(date) >= getWeekStart(today)) return current;
      return withStepMode(undefined, { mode, stepLogs, foodLog, plan: nutritionPlan, targetDailySteps: goal, weightKg, today: scope === 'week' ? getWeekEnd(date) : date });
    },
    [current, today, mode, stepLogs, foodLog, nutritionPlan, goal, weightKg],
  );
}
