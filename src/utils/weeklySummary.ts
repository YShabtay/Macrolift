import type { AppState } from '../types/fitness';
import { getStepsForDate } from './stepsCalculations';
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
  steps: { average: number; daysLogged: number; goal: number };
  nutrition: { daysLogged: number; avgCalories: number; targetCalories: number; avgProteinG: number; targetProteinG: number };
  weight: { latest: number | null; changeKg: number | null };
}

type SummaryState = Pick<
  AppState,
  'foodLog' | 'progress' | 'workoutPlan' | 'completedWorkoutDates' | 'stepLogs' | 'weightLogs' | 'schedule' | 'nutritionPlan' | 'profile' | 'stepGoal'
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
  const stepsAverage = stepDays.length > 0 ? Math.round(stepDays.reduce((a, b) => a + b, 0) / stepDays.length) : 0;
  const stepGoal = state.stepGoal ?? defaultStepGoal;

  // Nutrition
  const foodDays = dates.filter((d) => state.foodLog.some((f) => f.date === d));
  const totalCalories = foodDays.reduce((sum, d) => sum + state.foodLog.filter((f) => f.date === d).reduce((s, f) => s + f.calories, 0), 0);
  const totalProtein = foodDays.reduce((sum, d) => sum + state.foodLog.filter((f) => f.date === d).reduce((s, f) => s + f.proteinG, 0), 0);
  const avgCalories = foodDays.length > 0 ? Math.round(totalCalories / foodDays.length) : 0;
  const avgProteinG = foodDays.length > 0 ? Math.round(totalProtein / foodDays.length) : 0;

  // Weight: the last weigh-in of the week against the latest one before it (or the week's first, when there is nothing earlier).
  const weekWeights = state.weightLogs.filter((w) => inWeek(w.date) && w.date <= lastDay).sort((a, b) => a.date.localeCompare(b.date));
  const earlier = state.weightLogs.filter((w) => w.date < weekStart).sort((a, b) => b.date.localeCompare(a.date))[0];
  const latest = weekWeights.length > 0 ? weekWeights[weekWeights.length - 1].weightKg : null;
  const baseline = earlier?.weightKg ?? (weekWeights.length > 1 ? weekWeights[0].weightKg : null);
  const changeKg = latest !== null && baseline !== null ? round1(latest - baseline) : null;

  return {
    weekStart,
    weekEnd,
    daysElapsed: dates.length,
    workouts: { done: doneDates.length, planned },
    sets,
    volumeKg,
    personalRecords,
    steps: { average: stepsAverage, daysLogged: stepDays.length, goal: stepGoal },
    nutrition: { daysLogged: foodDays.length, avgCalories, targetCalories: state.nutritionPlan.targetCalories, avgProteinG, targetProteinG: state.nutritionPlan.macros.proteinG },
    weight: { latest, changeKg },
  };
}
