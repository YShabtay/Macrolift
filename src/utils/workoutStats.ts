import type { SetProgressEntry, WorkoutPlan } from '../types/fitness';
import { isDayCompleted } from './scheduleHelpers';
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
): number {
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(today);

  const datesThisWeek = new Set(
    progress.filter((p) => p.date >= weekStart && p.date <= weekEnd).map((p) => p.date),
  );

  let completedCount = 0;
  for (const date of datesThisWeek) {
    if (isDayCompleted(workoutPlan, progress, date)) completedCount++;
  }
  return completedCount;
}
