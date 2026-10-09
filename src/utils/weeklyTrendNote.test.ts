import { describe, expect, it } from 'vitest';
import type { WeightLog } from '../types/fitness';
import { describeTrendNote, getWeeklyTrendNote } from './weeklyTrendNote';

// Weeks start on Sunday: 9/6, 9/13, 9/20, 9/27 (and 10/4 in progress on 10/8).
const log = (date: string, weightKg: number): WeightLog => ({ id: date, date, weightKg });
const week = (sunday: string, kg: number): WeightLog[] => [log(sunday, kg), log(sunday.replace(/\d\d$/, (d) => String(Number(d) + 2).padStart(2, '0')), kg)];
const TODAY = '2026-10-08';
const base = { weightKg: 69, today: TODAY, since: '2026-08-01', intensity: 'moderate' as const };

describe('getWeeklyTrendNote', () => {
  it('suggests eating more when a bulk\'s weekly average does not rise for three weeks in a row', () => {
    const logs = [...week('2026-09-13', 68.4), ...week('2026-09-20', 68.4), ...week('2026-09-27', 68.3)];
    const note = getWeeklyTrendNote({ ...base, weightLogs: logs, goal: 'gain_muscle' })!;
    expect(note.kind).toBe('behind');
    expect(note.eatMore).toBe(true);
    expect(note.suggestedDeltaKcal).toBeGreaterThanOrEqual(100);
    expect(note.suggestedDeltaKcal).toBeLessThanOrEqual(300);
    expect(note.weeks.map((w) => w.averageKg)).toEqual([68.4, 68.4, 68.3]);
    expect(describeTrendNote(note)).toContain('3 שבועות');
  });

  it('uses the last four weeks when there are four, and says how many', () => {
    const logs = [...week('2026-09-06', 68.5), ...week('2026-09-13', 68.4), ...week('2026-09-20', 68.3), ...week('2026-09-27', 68.2)];
    const note = getWeeklyTrendNote({ ...base, weightLogs: logs, goal: 'gain_muscle' })!;
    expect(note.weeks).toHaveLength(4);
    expect(describeTrendNote(note)).toContain('4 שבועות');
  });

  it('suggests eating less when a cut is not going down for three weeks', () => {
    const logs = [...week('2026-09-13', 70), ...week('2026-09-20', 70.2), ...week('2026-09-27', 70.3)];
    const note = getWeeklyTrendNote({ ...base, weightLogs: logs, goal: 'lose_weight' })!;
    expect(note.kind).toBe('behind');
    expect(note.eatMore).toBe(false);
    expect(note.suggestedDeltaKcal).toBeLessThan(0);
  });

  it('suggests eating less when a bulk gains much faster than planned for three weeks', () => {
    const logs = [...week('2026-09-13', 67), ...week('2026-09-20', 68), ...week('2026-09-27', 69.1)];
    const note = getWeeklyTrendNote({ ...base, weightLogs: logs, goal: 'gain_muscle' })!;
    expect(note.kind).toBe('ahead');
    expect(note.eatMore).toBe(false);
  });

  it('on maintenance, a steady drift either way is called out and pushed back', () => {
    const up = getWeeklyTrendNote({ ...base, goal: 'maintain', weightLogs: [...week('2026-09-13', 68), ...week('2026-09-20', 68.6), ...week('2026-09-27', 69.3)] })!;
    expect(up.kind).toBe('drifting-up');
    expect(up.eatMore).toBe(false);
    const down = getWeeklyTrendNote({ ...base, goal: 'maintain', weightLogs: [...week('2026-09-13', 70), ...week('2026-09-20', 69.4), ...week('2026-09-27', 68.7)] })!;
    expect(down.kind).toBe('drifting-down');
    expect(down.eatMore).toBe(true);
  });

  it('stays quiet when the weeks are on pace, mixed, or too few', () => {
    expect(getWeeklyTrendNote({ ...base, goal: 'gain_muscle', weightLogs: [...week('2026-09-13', 68), ...week('2026-09-20', 68.2), ...week('2026-09-27', 68.4)] })).toBeNull(); // +0.2 a week: on pace
    expect(getWeeklyTrendNote({ ...base, goal: 'gain_muscle', weightLogs: [...week('2026-09-13', 68), ...week('2026-09-20', 67.8), ...week('2026-09-27', 68.4)] })).toBeNull(); // one up week breaks the run
    expect(getWeeklyTrendNote({ ...base, goal: 'gain_muscle', weightLogs: [...week('2026-09-20', 68), ...week('2026-09-27', 67.8)] })).toBeNull(); // only two weeks
  });

  it('needs consecutive weeks with enough weigh-ins, and ignores the week in progress', () => {
    const gap = [...week('2026-09-06', 68.4), ...week('2026-09-20', 68.3), ...week('2026-09-27', 68.2)]; // 9/13 missing: the run is only two weeks
    expect(getWeeklyTrendNote({ ...base, goal: 'gain_muscle', weightLogs: gap })).toBeNull();
    const single = [...week('2026-09-13', 68.4), log('2026-09-20', 68.4), ...week('2026-09-27', 68.3)]; // one weigh-in in the middle week
    expect(getWeeklyTrendNote({ ...base, goal: 'gain_muscle', weightLogs: single })).toBeNull();
    const current = [...week('2026-09-20', 68.4), ...week('2026-09-27', 68.4), ...week('2026-10-04', 68.3)]; // the third is the week in progress
    expect(getWeeklyTrendNote({ ...base, goal: 'gain_muscle', weightLogs: current })).toBeNull();
  });

  it('only counts weeks that started after the last change to the target', () => {
    const logs = [...week('2026-09-13', 68.4), ...week('2026-09-20', 68.4), ...week('2026-09-27', 68.3)];
    expect(getWeeklyTrendNote({ ...base, since: '2026-09-18', goal: 'gain_muscle', weightLogs: logs })).toBeNull(); // only 9/20 and 9/27 ran on the new target
    expect(getWeeklyTrendNote({ ...base, since: '2026-09-12', goal: 'gain_muscle', weightLogs: logs })).not.toBeNull();
  });
});
