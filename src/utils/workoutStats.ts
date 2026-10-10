import type { Exercise, SetProgressEntry, WorkoutPlan } from '../types/fitness';
import { isWorkoutDateDone } from './scheduleHelpers';
import { addDaysIso } from './dateMath';
import { todayIso } from './weightCalculations';

/**
 * The workout counter: how far the person is through the current training week, as `count` of `target` (the plan's sessions a week). A training week
 * starts with a workout and holds up to `target` of them within 7 days; the workout after that starts a new one, so on a 3-a-week plan the counter
 * reads 1/3, 2/3, 3/3 and then 1/3 again, whichever day of the week that falls on (a Saturday start one week and a Sunday start the next work alike).
 * A training week that began more than 7 days ago and was not finished is over, and the counter reads 0 until the next workout. "Completed" is
 * decided by the same `isWorkoutDateDone` the calendar uses, so the dashboard and calendar can never disagree about what counts. All dates are local
 * YYYY-MM-DD strings (no UTC conversion), compared lexicographically.
 */
export function getWorkoutWeekProgress(
  workoutPlan: WorkoutPlan,
  progress: SetProgressEntry[],
  target: number,
  today: string = todayIso(),
  completedDates: readonly string[] = [],
): { count: number; target: number } {
  const perWeek = Math.max(Math.round(target), 1);
  const dates = [...new Set([...progress.map((p) => p.date), ...completedDates])]
    .filter((d) => d <= today && isWorkoutDateDone(workoutPlan, progress, d, completedDates))
    .sort();

  let weekStart: string | null = null;
  let count = 0;
  for (const date of dates) {
    if (weekStart === null || count >= perWeek || date > addDaysIso(weekStart, 6)) {
      weekStart = date;
      count = 1;
    } else {
      count += 1;
    }
  }
  const isOver = weekStart === null || today > addDaysIso(weekStart, 6);
  return { count: isOver ? 0 : count, target: perWeek };
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
