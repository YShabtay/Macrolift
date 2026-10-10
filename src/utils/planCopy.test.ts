import { describe, expect, it } from 'vitest';
import type { DayWorkout, Exercise } from '../types/fitness';
import { copyExercises, copyExercisesInto, duplicateSession } from './planCopy';

const ex = (id: string, name: string): Exercise => ({ id, name, muscleGroup: 'chest', equipment: 'barbell', sets: 3, repsRange: '8-12', restSeconds: 90 });
const day = (id: string, label: string, exercises: Exercise[]): DayWorkout => ({ id, dayLabel: label, focus: `${label} focus`, exercises });

describe('copying a session in the plan builder', () => {
  const a = day('a', 'אימון A', [ex('1', 'לחיצת חזה'), ex('2', 'חתירה')]);

  it('gives every copied exercise its own id, so progress is never shared between the two sessions', () => {
    const copies = copyExercises(a.exercises);
    expect(copies.map((e) => e.name)).toEqual(['לחיצת חזה', 'חתירה']);
    expect(copies.every((c) => !a.exercises.some((e) => e.id === c.id))).toBe(true);
    expect(new Set(copies.map((c) => c.id)).size).toBe(2);
    expect(a.exercises.map((e) => e.id)).toEqual(['1', '2']); // the original is untouched
  });

  it('keeps sets, reps and rest when copying', () => {
    const custom = { ...ex('3', 'סקוואט'), sets: 5, repsRange: '5', restSeconds: 180 };
    expect(copyExercises([custom])[0]).toMatchObject({ name: 'סקוואט', sets: 5, repsRange: '5', restSeconds: 180 });
  });

  it('duplicates a whole session under a new id and name, with the same focus', () => {
    const b = duplicateSession(a, 'אימון C');
    expect(b.id).not.toBe(a.id);
    expect(b.dayLabel).toBe('אימון C');
    expect(b.focus).toBe(a.focus);
    expect(b.exercises).toHaveLength(2);
  });

  it('fills an empty session with all the exercises and keeps that session\'s name and focus', () => {
    const emptyB = day('b', 'אימון B', []);
    const filled = copyExercisesInto(emptyB, a, 14);
    expect(filled.id).toBe('b');
    expect(filled.dayLabel).toBe('אימון B');
    expect(filled.focus).toBe('אימון B focus');
    expect(filled.exercises.map((e) => e.name)).toEqual(['לחיצת חזה', 'חתירה']);
  });

  it('adds after the existing exercises of a session that already has some, and stops at the limit', () => {
    const b = day('b', 'אימון B', [ex('9', 'סקוואט')]);
    expect(copyExercisesInto(b, a, 14).exercises.map((e) => e.name)).toEqual(['סקוואט', 'לחיצת חזה', 'חתירה']);
    expect(copyExercisesInto(b, a, 2).exercises.map((e) => e.name)).toEqual(['סקוואט', 'לחיצת חזה']);
    expect(copyExercisesInto(b, a, 1).exercises.map((e) => e.name)).toEqual(['סקוואט']);
  });
});
