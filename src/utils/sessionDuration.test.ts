import { describe, expect, it } from 'vitest';
import type { DayWorkout, Exercise, UserMetrics } from '../types/fitness';
import { getWorkoutTemplate } from '../data/workoutTemplates';
import { estimateEnergyExpenditure } from './calculations';
import { DEFAULT_SESSION_MINUTES, estimateSessionMinutes, withSessionMinutes } from './sessionDuration';

const ex = (sets: number, restSeconds: number): Exercise => ({ id: `e${sets}${restSeconds}`, name: 'x', muscleGroup: 'chest', equipment: 'barbell', sets, repsRange: '8-12', restSeconds });
const day = (...exercises: Exercise[]): DayWorkout => ({ id: 'd', dayLabel: 'A', focus: '', exercises });

describe('estimateSessionMinutes', () => {
  it('adds up each set (45 s of work plus the rest) and a 5-minute warm-up', () => {
    // 6 exercises x 3 sets, 90 s rest: 18 sets x 135 s = 40.5 min, plus 5.
    expect(estimateSessionMinutes({ days: [day(...Array.from({ length: 6 }, () => ex(3, 90)))] })).toBe(46);
  });

  it('counts a longer session as longer: more sets and longer rests', () => {
    const short = estimateSessionMinutes({ days: [day(ex(3, 60), ex(3, 60), ex(3, 60), ex(3, 60))] });
    const long = estimateSessionMinutes({ days: [day(ex(4, 150), ex(4, 150), ex(4, 150), ex(4, 150), ex(4, 150))] });
    expect(long).toBeGreaterThan(short);
  });

  it('averages over the plan\'s sessions', () => {
    const a = day(ex(4, 90), ex(4, 90), ex(4, 90), ex(4, 90), ex(4, 90), ex(4, 90)); // 16*... long
    const b = day(ex(2, 60), ex(2, 60));
    const both = estimateSessionMinutes({ days: [a, b] });
    expect(both).toBeGreaterThan(estimateSessionMinutes({ days: [b] }));
    expect(both).toBeLessThan(estimateSessionMinutes({ days: [a] }));
  });

  it('falls back to an hour for a plan with no exercises, and stays between 25 and 90 minutes', () => {
    expect(estimateSessionMinutes({ days: [] })).toBe(DEFAULT_SESSION_MINUTES);
    expect(estimateSessionMinutes(undefined)).toBe(DEFAULT_SESSION_MINUTES);
    expect(estimateSessionMinutes({ days: [day(ex(1, 10))] })).toBe(25);
    expect(estimateSessionMinutes({ days: [day(...Array.from({ length: 14 }, () => ex(8, 240)))] })).toBe(90);
  });

  it('reads the built-in programs: shorter sessions in a 6-day split than in a 3-day full-body program', () => {
    const fbw = estimateSessionMinutes(getWorkoutTemplate('fbw', 3));
    const ppl = estimateSessionMinutes(getWorkoutTemplate('ppl', 6));
    expect(fbw).toBe(53);
    expect(ppl).toBeLessThan(fbw);
  });

  it('writes the result into the metrics', () => {
    const metrics = { weightKg: 70 } as UserMetrics;
    expect(withSessionMinutes(metrics, { days: [day(ex(3, 90))] }).sessionMinutes).toBe(estimateSessionMinutes({ days: [day(ex(3, 90))] }));
  });
});

describe('training calories follow the session length', () => {
  const base = { bmr: 1613, weightKg: 70, dailySteps: 4000, trainingDaysPerWeek: 3 };

  it('is the old figure for an hour, and scales with the length', () => {
    expect(estimateEnergyExpenditure({ ...base, sessionMinutes: 60 }).trainingKcal).toBe(Math.round((3 * 250) / 7)); // 107
    expect(estimateEnergyExpenditure({ ...base }).trainingKcal).toBe(107); // unknown length = an hour
    expect(estimateEnergyExpenditure({ ...base, sessionMinutes: 30 }).trainingKcal).toBe(Math.round((3 * 125) / 7)); // 54
    expect(estimateEnergyExpenditure({ ...base, sessionMinutes: 90 }).trainingKcal).toBeGreaterThan(150);
  });
});
