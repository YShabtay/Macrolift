import { describe, expect, it } from 'vitest';
import type { UserMetrics, WeightLog } from '../types/fitness';
import { getLatestSyncWeekStart, getWeightSyncSuggestion } from './profileWeightSync';

const metrics = { weightKg: 69 } as UserMetrics;
const log = (date: string, weightKg: number): WeightLog => ({ id: date, date, weightKg });
// Weeks start on Sunday: 9/20, 9/27, 10/4 (the week in progress on 10/8).
const week = (sunday: string, kg: number) => [log(sunday, kg), log(sunday.replace(/\d\d$/, (d) => String(Number(d) + 2).padStart(2, '0')), kg)];

describe('getWeightSyncSuggestion', () => {
  it('follows the last completed week\'s average once it is a kilo or more from the profile weight', () => {
    const logs = [...week('2026-09-20', 69.3), ...week('2026-09-27', 70.4)];
    expect(getWeightSyncSuggestion({ metrics, weightLogs: logs, today: '2026-10-08' })).toEqual({ suggestedKg: 70.4, profileKg: 69, diffKg: 1.4 });
  });
  it('also works for losing weight', () => {
    expect(getWeightSyncSuggestion({ metrics, weightLogs: week('2026-09-27', 67.8), today: '2026-10-08' })?.diffKg).toBe(-1.2);
  });
  it('uses the average of the week, not a single weigh-in', () => {
    const logs = [log('2026-09-27', 71), log('2026-09-29', 69.1), log('2026-10-01', 69.4)];
    expect(getWeightSyncSuggestion({ metrics, weightLogs: logs, today: '2026-10-08' })).toBeNull(); // a 2 kg day in the week, but the average is 69.8
    expect(getWeightSyncSuggestion({ metrics, weightLogs: [...logs, log('2026-10-02', 72)], today: '2026-10-08' })?.suggestedKg).toBe(70.4);
  });
  it('stays quiet for a small drift, or for a week with a single weigh-in', () => {
    expect(getWeightSyncSuggestion({ metrics, weightLogs: week('2026-09-27', 69.9), today: '2026-10-08' })).toBeNull();
    expect(getWeightSyncSuggestion({ metrics, weightLogs: [log('2026-09-28', 72)], today: '2026-10-08' })).toBeNull();
  });
  it('ignores the week still in progress', () => {
    expect(getWeightSyncSuggestion({ metrics, weightLogs: week('2026-10-04', 72), today: '2026-10-08' })).toBeNull();
    expect(getWeightSyncSuggestion({ metrics, weightLogs: [...week('2026-09-27', 69.2), ...week('2026-10-04', 72)], today: '2026-10-08' })).toBeNull();
  });
  it('settles once the profile sits on the average', () => {
    const logs = week('2026-09-27', 70.4);
    expect(getWeightSyncSuggestion({ metrics: { weightKg: 70.4 } as UserMetrics, weightLogs: logs, today: '2026-10-08' })).toBeNull();
  });
});

describe('getLatestSyncWeekStart', () => {
  it('is the Sunday of the latest completed week that has an average', () => {
    expect(getLatestSyncWeekStart([...week('2026-09-20', 69), ...week('2026-10-04', 70)], '2026-10-08')).toBe('2026-09-20');
    expect(getLatestSyncWeekStart([...week('2026-09-20', 69), ...week('2026-10-04', 70)], '2026-10-12')).toBe('2026-10-04');
    expect(getLatestSyncWeekStart([], '2026-10-08')).toBeNull();
  });
});
