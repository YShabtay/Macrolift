import { describe, expect, it } from 'vitest';
import type { UserMetrics, WeightLog } from '../types/fitness';
import { getWeightSyncSuggestion } from './profileWeightSync';

const metrics = { weightKg: 69 } as UserMetrics;
const log = (date: string, weightKg: number): WeightLog => ({ id: date, date, weightKg });
// Weeks start on Sunday: 9/20, 9/27, 10/4 (the week in progress on 10/8).
const week = (sunday: string, kg: number) => [log(sunday, kg), log(sunday.replace(/\d\d$/, (d) => String(Number(d) + 2).padStart(2, '0')), kg)];

describe('getWeightSyncSuggestion', () => {
  it('suggests the latest weekly average once two weeks in a row sit 2 kg or more from the profile weight', () => {
    const logs = [...week('2026-09-20', 71.2), ...week('2026-09-27', 71.6)];
    expect(getWeightSyncSuggestion({ metrics, weightLogs: logs, today: '2026-10-08' })).toEqual({ suggestedKg: 71.6, profileKg: 69, diffKg: 2.6 });
  });
  it('also works for losing weight', () => {
    const logs = [...week('2026-09-20', 66.5), ...week('2026-09-27', 66.1)];
    expect(getWeightSyncSuggestion({ metrics, weightLogs: logs, today: '2026-10-08' })?.diffKg).toBe(-2.9);
  });
  it('stays quiet for one odd week, a small drift, or too little data', () => {
    expect(getWeightSyncSuggestion({ metrics, weightLogs: [...week('2026-09-20', 69.3), ...week('2026-09-27', 71.8)], today: '2026-10-08' })).toBeNull();
    expect(getWeightSyncSuggestion({ metrics, weightLogs: [...week('2026-09-20', 70.2), ...week('2026-09-27', 70.4)], today: '2026-10-08' })).toBeNull();
    expect(getWeightSyncSuggestion({ metrics, weightLogs: week('2026-09-27', 72), today: '2026-10-08' })).toBeNull();
  });
  it('ignores the week still in progress and weeks with a single weigh-in', () => {
    const logs = [...week('2026-09-20', 71.2), log('2026-09-28', 72), ...week('2026-10-04', 72)];
    expect(getWeightSyncSuggestion({ metrics, weightLogs: logs, today: '2026-10-08' })).toBeNull();
  });
  it('does not mix an increase with a decrease', () => {
    expect(getWeightSyncSuggestion({ metrics, weightLogs: [...week('2026-09-20', 66.5), ...week('2026-09-27', 71.5)], today: '2026-10-08' })).toBeNull();
  });
});
