import type { DayWorkout, Exercise, MuscleGroup } from '../types/fitness';

/**
 * Gym-floor ordering: every exercise for a muscle area is done back to back, so the lifter walks to each station once
 * instead of returning to the legs after chest. Blocks: legs (quads, hamstrings, glutes, calves), pull (back),
 * push (chest then shoulders) and accessories (biceps, triceps, core). Within a block the heavy compounds come first,
 * isolation work after them; ties keep the order they were authored in.
 */
export type ExerciseBlock = 'legs' | 'pull' | 'push' | 'accessories';

export const STANDARD_BLOCK_ORDER: ExerciseBlock[] = ['legs', 'pull', 'push', 'accessories'];

const BLOCK_BY_MUSCLE: Record<MuscleGroup, ExerciseBlock> = {
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  back: 'pull',
  chest: 'push',
  shoulders: 'push',
  biceps: 'accessories',
  triceps: 'accessories',
  core: 'accessories',
  full_body: 'accessories',
};

/** Order of the muscles inside a block when they have to be separated (chest before shoulders unless told otherwise). */
const SUB_ORDER: MuscleGroup[] = ['chest', 'shoulders', 'biceps', 'triceps', 'core'];

const ISOLATION_NAME = /פרפר|הרחקת|כפיפת ברך|פשיטת ברך|כפיפת מרפק|פשיטת מרפק|שוקיים|בטן|פלאנק|הרמת ברכיים/;
const ISOLATION_MUSCLES: MuscleGroup[] = ['biceps', 'triceps', 'calves', 'core'];

function isIsolation(exercise: Exercise): boolean {
  return ISOLATION_MUSCLES.includes(exercise.muscleGroup) || ISOLATION_NAME.test(exercise.name);
}

export function blockOf(exercise: Exercise): ExerciseBlock {
  return BLOCK_BY_MUSCLE[exercise.muscleGroup];
}

export interface OrderOptions {
  /** Which block comes first, second, ...; blocks left out follow in the standard order. */
  blockOrder?: ExerciseBlock[];
  /** Put the shoulder exercises ahead of the chest ones inside the push block (shoulder-focused plans). */
  shouldersFirst?: boolean;
}

/** Returns the exercises regrouped into contiguous muscle blocks (stable and non-mutating). */
export function orderExercisesByBlock(exercises: Exercise[], options: OrderOptions = {}): Exercise[] {
  const order = [...(options.blockOrder ?? []), ...STANDARD_BLOCK_ORDER.filter((b) => !options.blockOrder?.includes(b))];
  const subOrder = options.shouldersFirst
    ? ['shoulders', ...SUB_ORDER.filter((m) => m !== 'shoulders')]
    : SUB_ORDER;
  const subRank = (e: Exercise) => {
    const i = subOrder.indexOf(e.muscleGroup);
    return i === -1 ? 0 : i;
  };

  return exercises
    .map((exercise, index) => ({ exercise, index }))
    .sort((a, b) => {
      const blockDiff = order.indexOf(blockOf(a.exercise)) - order.indexOf(blockOf(b.exercise));
      if (blockDiff !== 0) return blockDiff;
      // Push and accessory blocks hold several muscles: keep each muscle together, then compound before isolation.
      if (blockOf(a.exercise) !== 'legs' && blockOf(a.exercise) !== 'pull') {
        const subDiff = subRank(a.exercise) - subRank(b.exercise);
        if (subDiff !== 0) return subDiff;
      }
      const isoDiff = Number(isIsolation(a.exercise)) - Number(isIsolation(b.exercise));
      return isoDiff || a.index - b.index;
    })
    .map(({ exercise }) => exercise);
}

/** The block order a day already follows (first appearance of each block), so re-sorting never reshuffles its emphasis. */
export function inferBlockOrder(day: DayWorkout): ExerciseBlock[] {
  const seen: ExerciseBlock[] = [];
  for (const e of day.exercises) {
    const block = blockOf(e);
    if (!seen.includes(block)) seen.push(block);
  }
  return seen;
}
