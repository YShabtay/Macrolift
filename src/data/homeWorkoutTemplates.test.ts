import { describe, expect, it } from 'vitest';
import type { Equipment, HomeEquipment, MuscleGroup, WorkoutPlan } from '../types/fitness';
import { findExerciseTemplate } from './workoutTemplates';
import { isValidYouTubeId } from '../utils/exerciseVideo';
import {
  HOME_TEMPLATE_DAYS,
  HOME_TEMPLATE_EQUIPMENT,
  HOME_TEMPLATE_LEVELS,
  getHomeExerciseLibrary,
  getHomeWorkoutTemplate,
} from './homeWorkoutTemplates';
import { getWeeklySetsByMuscle } from '../utils/planVolume';

const BIG_FOUR: MuscleGroup[] = ['chest', 'back', 'quads', 'hamstrings'];
const MAX_SETS_PER_MUSCLE_PER_SESSION = 8;

const ALL = HOME_TEMPLATE_EQUIPMENT.flatMap((equipment) =>
  HOME_TEMPLATE_LEVELS.flatMap((level) => HOME_TEMPLATE_DAYS.map((days) => ({ equipment, level, days }))),
);
const label = ({ equipment, level, days }: (typeof ALL)[number]) => `${equipment}/${level}/${days} days`;

function allowedEquipment(equipment: HomeEquipment): Equipment[] {
  return equipment === 'none' ? ['bodyweight'] : ['bodyweight', 'dumbbell', 'band'];
}

describe('home workout programs', () => {
  it.each(ALL.map((c) => [label(c), c] as const))('%s is a well-formed home program', (_name, c) => {
    const plan = getHomeWorkoutTemplate(c.equipment, c.level, c.days);
    expect(plan.location).toBe('home');
    expect(plan.daysPerWeek).toBe(c.days);
    expect(plan.days).toHaveLength(c.days);

    const ids = plan.days.flatMap((d) => [d.id, ...d.exercises.map((e) => e.id)]);
    expect(new Set(ids).size).toBe(ids.length);

    for (const day of plan.days) {
      const names = day.exercises.map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
      expect(day.exercises.length).toBeGreaterThanOrEqual(6);
      expect(day.exercises.length).toBeLessThanOrEqual(8);
    }
  });

  it.each(ALL.map((c) => [label(c), c] as const))('%s only asks for equipment the user has', (_name, c) => {
    const plan = getHomeWorkoutTemplate(c.equipment, c.level, c.days);
    const allowed = allowedEquipment(c.equipment);
    for (const e of plan.days.flatMap((d) => d.exercises)) expect(allowed).toContain(e.equipment);
  });

  it.each(ALL.map((c) => [label(c), c] as const))('%s keeps the big four muscles in an effective weekly range', (_name, c) => {
    const plan = getHomeWorkoutTemplate(c.equipment, c.level, c.days);
    const totals = getWeeklySetsByMuscle(plan);
    const floor = c.level === 'beginner' && c.days === 3 ? 9 : 12;
    for (const muscle of BIG_FOUR) {
      const sets = totals.get(muscle) ?? 0;
      expect(sets, muscle).toBeGreaterThanOrEqual(floor);
      expect(sets, muscle).toBeLessThanOrEqual(16);
    }
  });

  it.each(ALL.map((c) => [label(c), c] as const))('%s never stacks too many sets on one muscle in a session', (_name, c) => {
    const plan = getHomeWorkoutTemplate(c.equipment, c.level, c.days);
    for (const day of plan.days) {
      const bySession = getWeeklySetsByMuscle({ days: [day] });
      for (const [muscle, sets] of bySession) expect(sets, `${day.id} ${muscle}`).toBeLessThanOrEqual(MAX_SETS_PER_MUSCLE_PER_SESSION);
    }
  });

  it.each(ALL.map((c) => [label(c), c] as const))('%s gives every exercise cues, an English name and swap options', (_name, c) => {
    const plan = getHomeWorkoutTemplate(c.equipment, c.level, c.days);
    const allowed = allowedEquipment(c.equipment);
    for (const e of plan.days.flatMap((d) => d.exercises)) {
      expect(e.nameEn, e.name).toBeTruthy();
      expect(e.cues?.length, e.name).toBeGreaterThan(0);
      expect(e.alternatives?.length, e.name).toBeGreaterThan(0);
      for (const alt of e.alternatives ?? []) {
        expect(alt.name).not.toBe(e.name);
        expect(alt.muscleGroup).toBe(e.muscleGroup);
        expect(allowed).toContain(alt.equipment);
      }
    }
  });
});

describe('home program levels', () => {
  it('uses easier variations for beginners and harder ones for advanced trainees', () => {
    const exercises = (level: 'beginner' | 'intermediate' | 'advanced') =>
      getHomeWorkoutTemplate('none', level, 3).days[0].exercises.map((e) => e.name);
    expect(exercises('beginner')).toContain('שכיבות סמיכה בשיפוע (ידיים על ספה)');
    expect(exercises('intermediate')).toContain('שכיבות סמיכה');
    expect(exercises('advanced')).toContain('שכיבות סמיכה עם רגליים מורמות');
  });

  it('gives beginners 3 sets on the main lifts and the others 4', () => {
    const mainSets = (level: 'beginner' | 'intermediate' | 'advanced') =>
      getHomeWorkoutTemplate('none', level, 3).days[0].exercises.find((e) => e.muscleGroup === 'chest')?.sets;
    expect(mainSets('beginner')).toBe(3);
    expect(mainSets('intermediate')).toBe(4);
    expect(mainSets('advanced')).toBe(4);
  });

  it('offers a one-step easier and a harder variation when swapping', () => {
    const push = getHomeWorkoutTemplate('none', 'intermediate', 3).days[0].exercises.find((e) => e.name === 'שכיבות סמיכה');
    const difficulties = new Set(push?.alternatives?.map((a) => a.difficulty));
    expect(difficulties.has('beginner')).toBe(true);
    expect(difficulties.has('advanced')).toBe(true);
  });
});

describe('home program frequency', () => {
  it('uses full-body for up to 3 days and upper/lower from 4', () => {
    expect(getHomeWorkoutTemplate('none', 'beginner', 3).splitType).toBe('fbw');
    expect(getHomeWorkoutTemplate('none', 'beginner', 4).splitType).toBe('upper_lower');
  });

  it('maps frequencies the home programs do not cover to the nearest one and says so', () => {
    const two = getHomeWorkoutTemplate('none', 'beginner', 2);
    expect(two.daysPerWeek).toBe(3);
    expect(two.adaptationNotes?.some((n) => n.includes('3 אימונים'))).toBe(true);
    for (const days of [5, 6] as const) {
      const plan = getHomeWorkoutTemplate('dumbbells', 'advanced', days);
      expect(plan.daysPerWeek).toBe(4);
      expect(plan.adaptationNotes?.some((n) => n.includes('עד 4 אימונים'))).toBe(true);
    }
  });
});

describe('home exercise videos', () => {
  it('uses a valid YouTube id wherever a video is set, and keeps a searchable English name for the rest', () => {
    for (const { equipment, level, days } of ALL) {
      for (const e of getHomeWorkoutTemplate(equipment, level, days).days.flatMap((d) => d.exercises)) {
        if (e.youtubeId !== undefined) expect(isValidYouTubeId(e.youtubeId), e.name).toBe(true);
        else expect(e.nameEn, e.name).toBeTruthy();
      }
    }
  });

  it('gives most exercises a video, and the library lookup returns the same one as the plan', () => {
    const library = getHomeExerciseLibrary();
    const withVideo = library.filter((e) => findExerciseTemplate(e.name)?.youtubeId);
    expect(withVideo.length / library.length).toBeGreaterThan(0.75);
    const plan = getHomeWorkoutTemplate('dumbbells', 'beginner', 3);
    for (const e of plan.days.flatMap((d) => d.exercises)) expect(findExerciseTemplate(e.name)?.youtubeId).toBe(e.youtubeId);
  });
});

describe('home exercise lookup', () => {
  const plan: WorkoutPlan = getHomeWorkoutTemplate('dumbbells', 'beginner', 3);

  it('is found by name so swapping to one brings its cues along', () => {
    const found = findExerciseTemplate('סקוואט גביע');
    expect(found?.muscleGroup).toBe('quads');
    expect(found?.cues?.length).toBeGreaterThan(0);
  });

  it('exposes every plan exercise in the library for the custom plan builder', () => {
    const library = new Set(getHomeExerciseLibrary().map((e) => e.name));
    for (const e of plan.days.flatMap((d) => d.exercises)) expect(library.has(e.name)).toBe(true);
  });
});
