import { describe, expect, it } from 'vitest';
import type { DayWorkout, Exercise, MuscleGroup, WorkoutPlan } from '../types/fitness';
import { WORKOUT_TEMPLATES } from '../data/workoutTemplates';
import { CORE_MUSCLES, WEEKLY_SET_TARGETS, classifyVolume, getMuscleVolumes, getWeeklySetsByMuscle } from './planVolume';

function planWith(sessions: Array<Array<[MuscleGroup, number]>>): Pick<WorkoutPlan, 'days'> {
  const days = sessions.map((exercises, i) => ({
    id: `day-${i}`,
    exercises: exercises.map(([muscleGroup, sets], j) => ({ id: `ex-${i}-${j}`, name: 'x', muscleGroup, sets }) as Exercise),
  })) as DayWorkout[];
  return { days };
}

describe('classifyVolume', () => {
  const target = { min: 12, max: 16 };

  it('is inclusive at both ends of the range', () => {
    expect(classifyVolume(11, target)).toBe('below');
    expect(classifyVolume(12, target)).toBe('in-range');
    expect(classifyVolume(16, target)).toBe('in-range');
    expect(classifyVolume(17, target)).toBe('above');
  });

  it('has no opinion for muscles without a target', () => {
    expect(classifyVolume(10, undefined)).toBe('none');
  });
});

describe('getWeeklySetsByMuscle', () => {
  it('sums sets for the same muscle across sessions and exercises', () => {
    const totals = getWeeklySetsByMuscle(
      planWith([
        [['chest', 4], ['back', 3]],
        [['chest', 3], ['chest', 2]],
      ]),
    );
    expect(totals.get('chest')).toBe(9);
    expect(totals.get('back')).toBe(3);
    expect(totals.get('quads')).toBeUndefined();
  });
});

describe('getMuscleVolumes', () => {
  it('always lists the big four, even at zero sets, flagged as below target', () => {
    const rows = getMuscleVolumes(planWith([[['biceps', 3]]]));
    for (const muscle of CORE_MUSCLES) {
      const row = rows.find((r) => r.muscle === muscle);
      expect(row).toMatchObject({ sets: 0, status: 'below' });
    }
  });

  it('shows a smaller muscle only once it has sets', () => {
    expect(getMuscleVolumes(planWith([[['chest', 4]]])).some((r) => r.muscle === 'calves')).toBe(false);
    expect(getMuscleVolumes(planWith([[['calves', 4]]])).some((r) => r.muscle === 'calves')).toBe(true);
  });
});

describe('built-in workout programs', () => {
  // Guards the volume tuning of the templates: chest, back, quads and hamstrings must land in the 12-16 weekly-set range.
  it.each(WORKOUT_TEMPLATES.map((t) => [t.id, t] as const))('%s keeps the big four muscle groups in range', (_id, template) => {
    const totals = getWeeklySetsByMuscle(template);
    for (const muscle of CORE_MUSCLES) {
      const target = WEEKLY_SET_TARGETS[muscle]!;
      const sets = totals.get(muscle) ?? 0;
      expect(sets, `${template.id}: ${muscle}`).toBeGreaterThanOrEqual(target.min);
      expect(sets, `${template.id}: ${muscle}`).toBeLessThanOrEqual(target.max);
    }
  });
});
