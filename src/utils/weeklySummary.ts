import type { AppState } from '../types/fitness';
import { getStepsForDate } from './stepsCalculations';
import { getDailyTargets } from './weeklyBalance';
import { getStepMode, withStepMode } from './weeklySteps';
import { buildWeeklySummaries } from './weightCalculations';
import { addDaysIso } from './dateMath';
import { estimateOneRepMax, sessionVolumeKg } from './setLogs';
import { getDoneWorkoutDates } from './streaks';
import { getWeekEnd, getWeekStart } from './weightCalculations';

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  /** Days of the week up to and including today (7 for a finished week). */
  daysElapsed: number;
  workouts: { done: number; planned: number };
  sets: number;
  volumeKg: number;
  personalRecords: number;
  /** `average` is over the days of the week that are over (a missing day counts as 0, like the step plan); today's partial count joins only on the first day of a week. */
  steps: { average: number; daysLogged: number; goal: number };
  /** `targetCalories` is the average of the days' real targets (step calories and a rebalance included), the same targets every calorie screen uses. */
  nutrition: { daysLogged: number; avgCalories: number; targetCalories: number; avgProteinG: number; targetProteinG: number };
  /** The week's average weight and its change from the previous week's average, like the progress tab (never a single weigh-in). */
  weight: { average: number | null; changeKg: number | null };
}

type SummaryState = Pick<
  AppState,
  'foodLog' | 'progress' | 'workoutPlan' | 'completedWorkoutDates' | 'stepLogs' | 'weightLogs' | 'schedule' | 'nutritionPlan' | 'profile' | 'stepGoal' | 'weeklyBalance' | 'stepMode'
>;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The week (Sunday-Saturday) containing `weekDate`, as of `today`. Reads only the saved history, so late edits show up at once. */
export function buildWeeklySummary(state: SummaryState, weekDate: string, today: string, defaultStepGoal: number): WeeklySummary {
  const weekStart = getWeekStart(weekDate);
  const weekEnd = getWeekEnd(weekDate);
  const lastDay = weekEnd < today ? weekEnd : today;
  const dates: string[] = [];
  for (let d = weekStart; d <= lastDay; d = addDaysIso(d, 1)) dates.push(d);
  const inWeek = (date: string) => date >= weekStart && date <= weekEnd;
  // A day that is still going is not a finished day: averages use the days that are over, and fall back to today only when it is the week's first day.
  const finishedDates = dates.filter((d) => d < today);
  const basisDates = finishedDates.length > 0 ? finishedDates : dates;
  // The day targets exactly as the calorie screens read them: the saved rebalance and the step calories of the chosen mode, derived from the history.
  const adjustment = withStepMode(state.weeklyBalance, {
    mode: getStepMode(state),
    stepLogs: state.stepLogs,
    foodLog: state.foodLog,
    plan: state.nutritionPlan,
    targetDailySteps: defaultStepGoal,
    weightKg: state.profile.metrics.weightKg,
    today: lastDay,
  });

  // Workouts
  const doneDates = getDoneWorkoutDates(state).filter(inWeek);
  const scheduledWorkouts = state.schedule.filter((s) => inWeek(s.date) && state.workoutPlan.days.some((d) => d.id === s.dayId)).length;
  const planned = scheduledWorkouts > 0 ? scheduledWorkouts : state.workoutPlan.daysPerWeek;

  // Sets, volume, personal records
  const weekEntries = state.progress.filter((p) => inWeek(p.date));
  const sets = weekEntries.reduce((sum, p) => sum + p.completedSets, 0);
  const volumeKg = weekEntries.reduce((sum, p) => sum + sessionVolumeKg(p.sets), 0);
  const bestBefore = new Map<string, number>();
  const bestInWeek = new Map<string, number>();
  for (const entry of state.progress) {
    if (!entry.exerciseName || entry.date > weekEnd) continue;
    const target = entry.date < weekStart ? bestBefore : bestInWeek;
    for (const set of entry.sets ?? []) {
      const e = estimateOneRepMax(set);
      if (e !== null && e > (target.get(entry.exerciseName) ?? 0)) target.set(entry.exerciseName, e);
    }
  }
  let personalRecords = 0;
  for (const [name, best] of bestInWeek) {
    const before = bestBefore.get(name);
    if (before !== undefined && best > before + 0.01) personalRecords += 1;
  }

  // Steps
  const stepDays = dates.map((d) => getStepsForDate(state.stepLogs, d)).filter((s) => s > 0);
  const basisSteps = basisDates.map((d) => getStepsForDate(state.stepLogs, d));
  const stepsAverage = stepDays.length > 0 && basisSteps.length > 0 ? Math.round(basisSteps.reduce((a, b) => a + b, 0) / basisSteps.length) : 0;
  const stepGoal = state.stepGoal ?? defaultStepGoal;

  // Nutrition
  const foodDays = basisDates.filter((d) => state.foodLog.some((f) => f.date === d));
  const totalCalories = foodDays.reduce((sum, d) => sum + state.foodLog.filter((f) => f.date === d).reduce((s, f) => s + f.calories, 0), 0);
  const totalProtein = foodDays.reduce((sum, d) => sum + state.foodLog.filter((f) => f.date === d).reduce((s, f) => s + f.proteinG, 0), 0);
  const avgCalories = foodDays.length > 0 ? Math.round(totalCalories / foodDays.length) : 0;
  const avgProteinG = foodDays.length > 0 ? Math.round(totalProtein / foodDays.length) : 0;
  const targetCalories =
    foodDays.length > 0
      ? Math.round(foodDays.reduce((sum, d) => sum + getDailyTargets(state.nutritionPlan, adjustment, d).calories, 0) / foodDays.length)
      : state.nutritionPlan.targetCalories;

  // Weight: the week's average against the previous week's average, the same numbers as the progress tab.
  const weightWeeks = buildWeeklySummaries(state.weightLogs.filter((w) => w.date <= lastDay));
  const thisWeek = weightWeeks.find((w) => w.weekStart === weekStart);
  const before = weightWeeks.filter((w) => w.weekStart < weekStart).pop();
  const average = thisWeek?.averageKg ?? null;
  const changeKg = average !== null && before ? round1(average - before.averageKg) : null;

  return {
    weekStart,
    weekEnd,
    daysElapsed: dates.length,
    workouts: { done: doneDates.length, planned },
    sets,
    volumeKg,
    personalRecords,
    steps: { average: stepsAverage, daysLogged: stepDays.length, goal: stepGoal },
    nutrition: { daysLogged: foodDays.length, avgCalories, targetCalories, avgProteinG, targetProteinG: state.nutritionPlan.macros.proteinG },
    weight: { average, changeKg },
  };
}
