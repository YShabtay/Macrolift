import type { Exercise, SetProgressEntry, WorkoutPlan } from '../types/fitness';
import { isWorkoutDateDone } from './scheduleHelpers';
import { getWeekEnd, getWeekStart, todayIso } from './weightCalculations';

/**
 * Counts distinct dates, within the Sunday-Saturday calendar week containing `today`, on which a
 * workout-plan day was completed. "Completed" is decided by the same `isDayCompleted` the
 * calendar uses, so the dashboard and calendar can never disagree about what counts. All dates
 * are local YYYY-MM-DD strings (no UTC conversion), compared lexicographically.
 */
export function countCompletedWorkoutsThisWeek(
  workoutPlan: WorkoutPlan,
  progress: SetProgressEntry[],
  today: string = todayIso(),
  completedDates: readonly string[] = [],
): number {
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(today);

  const datesThisWeek = new Set(
    [...progress.map((p) => p.date), ...completedDates].filter((d) => d >= weekStart && d <= weekEnd),
  );

  let completedCount = 0;
  for (const date of datesThisWeek) {
    if (isWorkoutDateDone(workoutPlan, progress, date, completedDates)) completedCount++;
  }
  return completedCount;
}

export interface PreviousPerformance {
  date: string;
  completedSets: number;
}

/**
 * Last time each exercise was trained before `today`: the most recent progress entry with at least one completed set,
 * keyed by exercise id. (The app records how many sets were checked off, not weight or reps, so that's what "previous" can show.)
 */
export function getPreviousPerformances(progress: SetProgressEntry[], today: string = todayIso()): Map<string, PreviousPerformance> {
  const latest = new Map<string, PreviousPerformance>();
  for (const entry of progress) {
    if (entry.date >= today || entry.completedSets <= 0) continue;
    const current = latest.get(entry.exerciseId);
    if (!current || entry.date > current.date) latest.set(entry.exerciseId, { date: entry.date, completedSets: entry.completedSets });
  }
  return latest;
}

/** Rest to use when an exercise has no usable rest time: 90 s for big compound lifts, 60 s for isolation work. */
export function getDefaultRestSeconds(exercise: Pick<Exercise, 'restSeconds' | 'equipment' | 'muscleGroup'>): number {
  if (Number.isFinite(exercise.restSeconds) && exercise.restSeconds > 0) return exercise.restSeconds;
  const isCompound =
    exercise.equipment === 'barbell' || ['quads', 'hamstrings', 'glutes', 'back', 'chest'].includes(exercise.muscleGroup);
  return isCompound ? 90 : 60;
}
