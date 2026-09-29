import type { Exercise, ExerciseAlternative } from '../types/fitness';
import { findExerciseTemplate } from '../data/workoutTemplates';

/** Strips any swap history off an exercise, leaving a plain snapshot of its current values. */
function stripHistory(exercise: Exercise): Exercise {
  const { replacedFrom: _replacedFrom, ...rest } = exercise;
  return rest;
}

/**
 * Builds the replacement Exercise for a swap. Sets and rest time are kept from the
 * true original (so re-swapping doesn't compound changes), reps follow the
 * alternative when it specifies its own range, and `replacedFrom` always points at
 * the true original so "revert to original" works no matter how many swaps happened.
 */
export function buildSwappedExercise(current: Exercise, alternative: ExerciseAlternative): Exercise {
  const trueOriginal = current.replacedFrom ?? stripHistory(current);
  const template = findExerciseTemplate(alternative.name);

  return {
    id: alternative.id,
    name: alternative.name,
    muscleGroup: alternative.muscleGroup,
    equipment: alternative.equipment,
    sets: trueOriginal.sets,
    repsRange: alternative.repsRange ?? trueOriginal.repsRange,
    restSeconds: trueOriginal.restSeconds,
    youtubeId: template?.youtubeId,
    cues: template?.cues,
    alternatives: trueOriginal.alternatives,
    replacedFrom: trueOriginal,
  };
}

/** Restores a swapped-in exercise back to the original the user started with. No-op if it was never swapped. */
export function revertSwappedExercise(exercise: Exercise): Exercise {
  return exercise.replacedFrom ?? exercise;
}
