import { describe, expect, it } from 'vitest';
import type { ExperienceProfile } from '../types/fitness';
import { WORKOUT_TEMPLATES, getExerciseAlternatives, getWorkoutTemplate } from '../data/workoutTemplates';
import { CORE_MUSCLES, WEEKLY_SET_TARGETS, getWeeklySetsByMuscle } from './planVolume';
import { ADVANCED_SWAPS, BEGINNER_SWAPS, adaptWorkoutPlan, getExperienceLevel } from './workoutAdaptation';

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

const names = (plan: typeof BASE) => plan.days.flatMap((d) => d.exercises.map((e) => e.name));
const NOT_TRAINING: ExperienceProfile = { isCurrentlyTraining: false };
const BEGINNER = trainee({ experienceYears: 'under_1y' });
const INTERMEDIATE = trainee({ experienceYears: '1_3y' });
const ADVANCED = trainee({ experienceYears: 'over_3y' });
const TECHNICAL_BARBELL_LIFTS = ['סקוואט מוט', 'דדליפט רומני', 'לחיצת חזה במוט שטוח', 'חתירת מוט חבוק', 'לחיצת כתפיים בעמידה'];

describe('getExperienceLevel', () => {
  it('maps the declared years to a level and treats someone not training as a beginner', () => {
    expect(getExperienceLevel(NOT_TRAINING)).toBe('beginner');
    expect(getExperienceLevel(BEGINNER)).toBe('beginner');
    expect(getExperienceLevel(INTERMEDIATE)).toBe('intermediate');
    expect(getExperienceLevel(ADVANCED)).toBe('advanced');
  });

  it('has no level without experience data, or for a trainee who did not say for how long', () => {
    expect(getExperienceLevel(undefined)).toBeUndefined();
    expect(getExperienceLevel(trainee())).toBeUndefined();
  });
});

describe('adaptWorkoutPlan: no experience data', () => {
  it.each(WORKOUT_TEMPLATES.map((t) => [t.id, t] as const))('%s is returned untouched', (_id, template) => {
    expect(adaptWorkoutPlan(template, undefined).plan).toBe(template);
    const unknownYears = adaptWorkoutPlan(template, trainee()).plan;
    expect(names(unknownYears)).toEqual(names(template));
    expect(unknownYears.title).toBe(template.title);
  });
});

describe('adaptWorkoutPlan: beginners', () => {
  it.each(WORKOUT_TEMPLATES.map((t) => [t.id, t] as const))('%s drops the technical barbell lifts for stable versions', (_id, template) => {
    const { plan } = adaptWorkoutPlan(template, BEGINNER);
    const chosen = names(plan);
    for (const lift of TECHNICAL_BARBELL_LIFTS) expect(chosen, lift).not.toContain(lift);
    expect(names(template).some((n) => TECHNICAL_BARBELL_LIFTS.includes(n))).toBe(true);
    expect(plan.title).toContain('מותאם אישית');
  });

  it('treats someone who is not training exactly like an under-one-year trainee', () => {
    const fromNotTraining = adaptWorkoutPlan(BASE, NOT_TRAINING).plan;
    const fromUnderYear = adaptWorkoutPlan(BASE, BEGINNER).plan;
    expect(names(fromNotTraining)).toEqual(names(fromUnderYear));
    expect(fromNotTraining.title).toContain('מותאם אישית');
  });

  it.each(WORKOUT_TEMPLATES.map((t) => [t.id, t] as const))('%s keeps every muscle at the same weekly sets as the base program', (_id, template) => {
    const before = getWeeklySetsByMuscle(template);
    const after = getWeeklySetsByMuscle(adaptWorkoutPlan(template, BEGINNER).plan);
    expect([...after.entries()].sort()).toEqual([...before.entries()].sort());
    for (const muscle of CORE_MUSCLES) {
      const sets = after.get(muscle) ?? 0;
      expect(sets, `${template.id}: ${muscle}`).toBeGreaterThanOrEqual(WEEKLY_SET_TARGETS[muscle]!.min);
      expect(sets, `${template.id}: ${muscle}`).toBeLessThanOrEqual(WEEKLY_SET_TARGETS[muscle]!.max);
    }
  });

  it('never puts the same exercise in a session twice, and keeps ids and set counts', () => {
    for (const template of WORKOUT_TEMPLATES) {
      const { plan } = adaptWorkoutPlan(template, BEGINNER);
      plan.days.forEach((day, d) => {
        const inDay = day.exercises.map((e) => e.name);
        expect(new Set(inDay).size, `${template.id} ${day.id}`).toBe(inDay.length);
        expect(day.exercises.map((e) => e.id).sort()).toEqual(template.days[d].exercises.map((e) => e.id).sort());
        expect(day.exercises.reduce((n, e) => n + e.sets, 0)).toBe(template.days[d].exercises.reduce((n, e) => n + e.sets, 0));
      });
    }
  });

  it('keeps the original in replacedFrom, so the existing revert button restores it', () => {
    const { plan } = adaptWorkoutPlan(BASE, BEGINNER);
    const squat = plan.days.flatMap((d) => d.exercises).find((e) => e.replacedFrom?.name === 'סקוואט מוט');
    expect(squat?.name).toBe('לחיצת רגליים במכונה');
    expect(squat?.replacedFrom?.sets).toBe(squat?.sets);
    expect(BASE.days.flatMap((d) => d.exercises).some((e) => e.replacedFrom)).toBe(false);
  });

  it('only swaps in exercises the source lists as a beginner-level option', () => {
    for (const swap of BEGINNER_SWAPS) {
      for (const target of swap.to) {
        const alt = getExerciseAlternatives(swap.from)?.find((a) => a.name === target);
        expect(alt, `${swap.from} -> ${target}`).toBeDefined();
        expect(alt?.difficulty, `${swap.from} -> ${target}`).toBe('beginner');
      }
    }
  });

  it('explains the changes, marks the first lift of each session with light acclimation sets, and adds no sets for them', () => {
    const { plan, notes } = adaptWorkoutPlan(BASE, BEGINNER);
    expect(notes.some((n) => n.includes('תוכנית למתחילים'))).toBe(true);
    expect(notes.some((n) => n.includes('שבועיים ראשונים'))).toBe(true);
    expect(plan.adaptationNotes).toEqual(notes);
    for (const day of plan.days) {
      expect(day.exercises[0].notes).toContain('שבועיים ראשונים');
      expect(day.exercises.slice(1).some((e) => e.notes?.includes('סטי היכרות'))).toBe(false);
    }
  });

  it('lets an injury substitution win over the experience swap', () => {
    const { plan } = adaptWorkoutPlan(BASE, { ...BEGINNER, injuries: ['shoulder'] });
    const chosen = names(plan);
    expect(chosen).toContain('לחיצת חזה בשיפוע עם משקולות');
    expect(chosen).not.toContain('לחיצת חזה במכונה');
  });
});

describe('adaptWorkoutPlan: intermediate and advanced', () => {
  it('leaves an intermediate trainee on the base exercises, titled as the base plan, with a progression tip', () => {
    for (const template of WORKOUT_TEMPLATES) {
      const { plan, notes } = adaptWorkoutPlan(template, INTERMEDIATE);
      expect(names(plan)).toEqual(names(template));
      expect(plan.title).toBe(template.title);
      expect(notes).toHaveLength(1);
    }
  });

  it('gives beginner, intermediate and advanced trainees different PPL exercise selections', () => {
    const ppl6 = getWorkoutTemplate('ppl', 6);
    const beginner = names(adaptWorkoutPlan(ppl6, BEGINNER).plan);
    const intermediate = names(adaptWorkoutPlan(ppl6, INTERMEDIATE).plan);
    const advanced = names(adaptWorkoutPlan(ppl6, ADVANCED).plan);
    expect(beginner).not.toEqual(intermediate);
    expect(advanced).not.toEqual(intermediate);
    expect(advanced).not.toEqual(beginner);
    expect(intermediate).toContain('סקוואט מוט');
    expect(advanced).toContain('סקוואט מוט');
    expect(beginner).not.toContain('סקוואט מוט');
    expect(advanced).toContain('לחיצה ארנולד');
    expect(intermediate).not.toContain('לחיצה ארנולד');
  });

  it('changes nothing but the shoulder press for an advanced trainee, and keeps the weekly sets', () => {
    for (const template of WORKOUT_TEMPLATES) {
      const { plan } = adaptWorkoutPlan(template, ADVANCED);
      const before = getWeeklySetsByMuscle(template);
      expect([...getWeeklySetsByMuscle(plan).entries()].sort()).toEqual([...before.entries()].sort());
      const changed = names(plan).filter((n, i) => n !== names(template)[i]);
      expect(changed.every((n) => n === 'לחיצה ארנולד'), template.id).toBe(true);
      // Programs without a machine press are not personalized, so they keep the base title.
      expect(plan.title.includes('מותאם אישית'), template.id).toBe(changed.length > 0);
    }
  });

  it('only swaps in exercises the source lists above beginner level', () => {
    for (const swap of ADVANCED_SWAPS) {
      for (const target of swap.to) {
        const alt = getExerciseAlternatives(swap.from)?.find((a) => a.name === target);
        expect(alt, `${swap.from} -> ${target}`).toBeDefined();
        expect(alt?.difficulty).not.toBe('beginner');
      }
    }
  });
});

describe('adaptWorkoutPlan: current split is information only', () => {
  it('mentions a different current split once, without changing the program or calling it personalized', () => {
    const { plan, notes } = adaptWorkoutPlan(BASE, trainee({ currentSplit: 'ppl' }));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('Push / Pull / Legs');
    expect(notes[0]).toContain('Upper / Lower');
    expect(names(plan)).toEqual(names(BASE));
    expect(plan.title).toBe(BASE.title);
  });

  it('stays quiet when the current split matches the program, or is custom', () => {
    expect(adaptWorkoutPlan(BASE, trainee({ currentSplit: 'upper_lower' })).notes).toEqual([]);
    expect(adaptWorkoutPlan(BASE, trainee({ currentSplit: 'custom' })).notes).toEqual([]);
  });
});
