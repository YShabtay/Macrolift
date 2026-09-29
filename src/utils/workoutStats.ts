import type { SetProgressEntry, WorkoutPlan } from '../types/fitness';
import { getWeekEnd, getWeekStart, todayIso } from './weightCalculations';

/**
 * Counts distinct dates, within the calendar week containing today, on which
 * every exercise of at least one workout-plan day was fully completed.
 */
export function countCompletedWorkoutsThisWeek(
  workoutPlan: WorkoutPlan,
  progress: SetProgressEntry[],
): number {
  const today = todayIso();
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(today);

  const datesThisWeek = new Set(
    progress.filter((p) => p.date >= weekStart && p.date <= weekEnd).map((p) => p.date),
  );

  let completedCount = 0;
  for (const date of datesThisWeek) {
    const dayFullyCompleted = workoutPlan.days.some((day) =>
      day.exercises.every((exercise) => {
        const entry = progress.find(
          (p) => p.date === date && p.dayId === day.id && p.exerciseId === exercise.id,
        );
        return (entry?.completedSets ?? 0) >= exercise.sets;
      }),
    );
    if (dayFullyCompleted) completedCount++;
  }

  return completedCount;
}
