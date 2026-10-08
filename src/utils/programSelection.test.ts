import { describe, expect, it } from 'vitest';
import type { UserMetrics } from '../types/fitness';
import { buildWorkoutProgram, gymExperienceChanged, trainsAtHome } from './programSelection';
import { mergeProfile } from './backupValidation';

const BASE: UserMetrics = {
  gender: 'male',
  age: 28,
  heightCm: 178,
  weightKg: 75,
  averageDailySteps: 8000,
  trainingDaysPerWeek: 3,
  bodyState: 'athletic',
  goal: 'maintain',
};

describe('buildWorkoutProgram', () => {
  it('keeps profiles without a location on the gym programs', () => {
    expect(trainsAtHome(BASE)).toBe(false);
    const plan = buildWorkoutProgram(BASE);
    expect(plan.location).toBeUndefined();
    expect(plan.id).toBe('fbw-3');
  });

  it('builds the home program for the profile equipment and level', () => {
    const plan = buildWorkoutProgram({ ...BASE, trainingLocation: 'home', homeEquipment: 'dumbbells', homeLevel: 'advanced', trainingDaysPerWeek: 4 });
    expect(plan.location).toBe('home');
    expect(plan.id).toBe('home-dumbbells-ul-4-advanced');
  });

  it('defaults a home profile with no equipment or level to the easiest bodyweight program', () => {
    expect(buildWorkoutProgram({ ...BASE, trainingLocation: 'home' }).id).toBe('home-none-fbw-3-beginner');
  });

  it('follows the requested frequency when switching programs', () => {
    const plan = buildWorkoutProgram({ ...BASE, trainingLocation: 'home' }, 'upper_lower', 4);
    expect(plan.splitType).toBe('upper_lower');
  });

  it('notes that a muscle emphasis is not applied to home programs', () => {
    const plan = buildWorkoutProgram({ ...BASE, trainingLocation: 'home', targetFocus: 'lower_body' });
    expect(plan.adaptationNotes?.some((n) => n.includes('דגש'))).toBe(true);
  });
});

describe('home training settings in a saved profile', () => {
  it('survive a backup round trip and ignore invalid values', () => {
    const merged = mergeProfile(undefined, { metrics: { trainingLocation: 'home', homeEquipment: 'dumbbells', homeLevel: 'intermediate' } });
    expect(merged.metrics.trainingLocation).toBe('home');
    expect(merged.metrics.homeEquipment).toBe('dumbbells');
    expect(merged.metrics.homeLevel).toBe('intermediate');

    const bad = mergeProfile(undefined, { metrics: { trainingLocation: 'moon', homeEquipment: 'jetpack', homeLevel: 'god' } });
    expect(bad.metrics.trainingLocation).toBeUndefined();
    expect(bad.metrics.homeEquipment).toBeUndefined();
    expect(bad.metrics.homeLevel).toBeUndefined();
  });
});

describe('gym programs and declared experience', () => {
  const names = (m: UserMetrics) => buildWorkoutProgram(m).days.flatMap((d) => d.exercises.map((e) => e.name));

  it('builds a different gym program for a beginner than for a trainee with over 3 years', () => {
    const beginner = names({ ...BASE, trainingDaysPerWeek: 5, experience: { isCurrentlyTraining: true, experienceYears: 'under_1y' } });
    const veteran = names({ ...BASE, trainingDaysPerWeek: 5, experience: { isCurrentlyTraining: true, experienceYears: 'over_3y' } });
    expect(beginner).not.toEqual(veteran);
    expect(beginner).not.toContain('סקוואט מוט');
    expect(veteran).toContain('סקוואט מוט');
  });

  it('leaves a profile with no experience data on the base program', () => {
    expect(buildWorkoutProgram(BASE).title).toBe('Full Body Workout');
  });

  it('flags a change of level on gym profiles only', () => {
    const beginner = { ...BASE, experience: { isCurrentlyTraining: true, experienceYears: 'under_1y' as const } };
    const veteran = { ...BASE, experience: { isCurrentlyTraining: true, experienceYears: 'over_3y' as const } };
    expect(gymExperienceChanged(beginner, veteran)).toBe(true);
    expect(gymExperienceChanged(BASE, beginner)).toBe(true);
    expect(gymExperienceChanged(beginner, { ...beginner, experience: { ...beginner.experience, injuries: ['knees' as const] } })).toBe(false);
    expect(gymExperienceChanged({ ...beginner, trainingLocation: 'home' }, { ...veteran, trainingLocation: 'home' })).toBe(false);
  });
});
