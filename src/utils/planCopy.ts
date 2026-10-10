import type { DayWorkout, Exercise } from '../types/fitness';

/** Copies of exercises that are safe to put in another session: each gets its own id, so progress logged on one never shows up on the other. */
export function copyExercises(exercises: Exercise[]): Exercise[] {
  return exercises.map((e) => ({ ...e, id: `cx-${crypto.randomUUID()}` }));
}

/** A new session with the same focus and exercises as `source` and its own id. */
export function duplicateSession(source: DayWorkout, label: string): DayWorkout {
  return { ...source, id: `cd-${crypto.randomUUID()}`, dayLabel: label, exercises: copyExercises(source.exercises) };
}

/**
 * Puts copies of another session's exercises into `target`: an empty session takes them all, one that already has exercises gets them added after
 * its own, up to `maxExercises` (anything beyond that is left out). Names, sets, reps and rest come along; the target keeps its own name and focus.
 */
export function copyExercisesInto(target: DayWorkout, source: DayWorkout, maxExercises: number): DayWorkout {
  const room = Math.max(maxExercises - target.exercises.length, 0);
  return { ...target, exercises: [...target.exercises, ...copyExercises(source.exercises.slice(0, room))] };
}
