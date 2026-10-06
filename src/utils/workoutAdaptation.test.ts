import { describe, expect, it } from 'vitest';
import type { ExperienceProfile } from '../types/fitness';
import { getWorkoutTemplate } from '../data/workoutTemplates';
import { adaptWorkoutPlan } from './workoutAdaptation';

const BASE = getWorkoutTemplate('upper_lower', 4);
const trainee = (overrides: Partial<ExperienceProfile> = {}): ExperienceProfile => ({ isCurrentlyTraining: true, ...overrides });

const setsAndReps = (plan: typeof BASE) => plan.days.flatMap((d) => d.exercises.map((e) => `${e.name}|${e.sets}|${e.repsRange}`));

describe('adaptWorkoutPlan: reported plateau', () => {
  it('leaves the sets and rep ranges alone: a deload is a choice for a week, not a permanent cut to the plan', () => {
    const { plan } = adaptWorkoutPlan(BASE, trainee({ hasPlateau: true }));
    expect(setsAndReps(plan).sort()).toEqual(setsAndReps(BASE).sort());
  });

  it('suggests what to check and when a deload makes sense, and says the plan was not changed', () => {
    const { plan, notes } = adaptWorkoutPlan(BASE, trainee({ hasPlateau: true }));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('deload');
    expect(notes[0]).toContain('לא שונתה');
    expect(plan.adaptationNotes).toEqual(notes);
  });

  it('does not call the plan personalized when the plateau was the only thing reported', () => {
    expect(adaptWorkoutPlan(BASE, trainee({ hasPlateau: true })).plan.title).toBe(BASE.title);
  });

  it('adds nothing when there is no plateau', () => {
    const { plan, notes } = adaptWorkoutPlan(BASE, trainee({ hasPlateau: false }));
    expect(notes).toEqual([]);
    expect(plan.adaptationNotes).toBeUndefined();
  });

  it('still personalizes for real changes such as injuries, and keeps the suggestion alongside', () => {
    const { plan, notes } = adaptWorkoutPlan(BASE, trainee({ hasPlateau: true, injuries: ['shoulder'] }));
    expect(plan.title).toContain('מותאם אישית');
    expect(notes.some((n) => n.includes('deload'))).toBe(true);
    expect(notes.length).toBeGreaterThan(1);
  });
});
