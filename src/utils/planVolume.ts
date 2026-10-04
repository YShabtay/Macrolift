import type { MuscleGroup, WorkoutPlan } from '../types/fitness';

export interface VolumeTarget {
  min: number;
  max: number;
}

/**
 * Weekly direct-set ranges the app's programs aim for. The big four (chest, back, quads, hamstrings) use 12-16 - the range the templates are
 * built around; the smaller muscles get lower ranges because they also work in the big lifts. Conventional guidance, not a measured prescription.
 */
export const WEEKLY_SET_TARGETS: Partial<Record<MuscleGroup, VolumeTarget>> = {
  chest: { min: 12, max: 16 },
  back: { min: 12, max: 16 },
  quads: { min: 12, max: 16 },
  hamstrings: { min: 12, max: 16 },
  shoulders: { min: 8, max: 14 },
  glutes: { min: 6, max: 14 },
  biceps: { min: 6, max: 12 },
  triceps: { min: 6, max: 12 },
  calves: { min: 6, max: 10 },
  core: { min: 6, max: 10 },
};

/** The muscles always shown (even at zero sets), because a plan without them is missing something. */
export const CORE_MUSCLES: MuscleGroup[] = ['chest', 'back', 'quads', 'hamstrings'];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'חזה',
  back: 'גב',
  shoulders: 'כתפיים',
  biceps: 'יד קדמית',
  triceps: 'יד אחורית',
  quads: 'ריבועי הירך',
  hamstrings: 'המסטרינג',
  glutes: 'ישבן',
  calves: 'שוקיים',
  core: 'בטן',
  full_body: 'גוף מלא',
};

export type VolumeStatus = 'below' | 'in-range' | 'above';

export interface MuscleVolume {
  muscle: MuscleGroup;
  sets: number;
  target?: VolumeTarget;
  status: VolumeStatus | 'none';
}

/** Total sets per muscle across all sessions of a plan (one week). */
export function getWeeklySetsByMuscle(plan: Pick<WorkoutPlan, 'days'>): Map<MuscleGroup, number> {
  const totals = new Map<MuscleGroup, number>();
  for (const day of plan.days) {
    for (const exercise of day.exercises) {
      totals.set(exercise.muscleGroup, (totals.get(exercise.muscleGroup) ?? 0) + exercise.sets);
    }
  }
  return totals;
}

export function classifyVolume(sets: number, target: VolumeTarget | undefined): VolumeStatus | 'none' {
  if (!target) return 'none';
  if (sets < target.min) return 'below';
  if (sets > target.max) return 'above';
  return 'in-range';
}

/** One row per muscle worth showing: every muscle with sets, plus the big four even when empty; ordered big muscles first. */
export function getMuscleVolumes(plan: Pick<WorkoutPlan, 'days'>): MuscleVolume[] {
  const totals = getWeeklySetsByMuscle(plan);
  const order = Object.keys(MUSCLE_LABELS) as MuscleGroup[];
  const muscles = order.filter((m) => (totals.get(m) ?? 0) > 0 || CORE_MUSCLES.includes(m));
  return muscles.map((muscle) => {
    const sets = totals.get(muscle) ?? 0;
    const target = WEEKLY_SET_TARGETS[muscle];
    return { muscle, sets, target, status: classifyVolume(sets, target) };
  });
}
