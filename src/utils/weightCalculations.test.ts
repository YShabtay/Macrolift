import { describe, expect, it } from 'vitest';
import type { WeightLog } from '../types/fitness';
import {
  buildWeeklySummaries,
  daysBetween,
  estimateWeightForDate,
  findWeightNearDate,
  formatDateDisplay,
  formatIsoDate,
  getWeekEnd,
  getWeekStart,
  parseIsoDate,
} from './weightCalculations';

const log = (date: string, weightKg: number): WeightLog => ({ id: date, date, weightKg });

describe('ISO date helpers', () => {
  it('round-trips a date without a timezone shift', () => {
    expect(formatIsoDate(parseIsoDate('2026-03-01'))).toBe('2026-03-01');
    expect(formatIsoDate(parseIsoDate('2026-12-31'))).toBe('2026-12-31');
  });

  it('formats short Hebrew-locale dates as DD.MM', () => {
    expect(formatDateDisplay('2026-03-05')).toBe('05.03');
  });

  it('counts whole days between dates, signed, across month and DST boundaries', () => {
    expect(daysBetween('2026-10-04', '2026-10-10')).toBe(6);
    expect(daysBetween('2026-10-10', '2026-10-04')).toBe(-6);
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
    expect(daysBetween('2026-03-20', '2026-03-30')).toBe(10); // spans the spring clock change
  });
});

describe('weeks run Sunday to Saturday', () => {
  it('finds the Sunday that starts any day of the week', () => {
    expect(getWeekStart('2026-10-04')).toBe('2026-10-04'); // Sunday
    expect(getWeekStart('2026-10-07')).toBe('2026-10-04'); // Wednesday
    expect(getWeekStart('2026-10-10')).toBe('2026-10-04'); // Saturday
    expect(getWeekStart('2026-10-11')).toBe('2026-10-11'); // next Sunday
  });

  it('works across month and year boundaries', () => {
    expect(getWeekStart('2026-10-01')).toBe('2026-09-27');
    expect(getWeekStart('2027-01-01')).toBe('2026-12-27');
  });

  it('ends the week on the following Saturday', () => {
    expect(getWeekEnd('2026-10-07')).toBe('2026-10-10');
    expect(getWeekEnd('2026-09-30')).toBe('2026-10-03');
  });
});

describe('buildWeeklySummaries', () => {
  it('averages each calendar week and reports the change from the previous week', () => {
    const summaries = buildWeeklySummaries([
      log('2026-09-27', 70.0),
      log('2026-09-28', 70.4),
      log('2026-09-29', 70.2),
      log('2026-10-04', 70.8),
      log('2026-10-06', 70.6),
    ]);
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({ weekStart: '2026-09-27', weekEnd: '2026-10-03', averageKg: 70.2, daysLogged: 3, deltaFromPreviousWeek: null });
    expect(summaries[1]).toMatchObject({ weekStart: '2026-10-04', averageKg: 70.7, daysLogged: 2, deltaFromPreviousWeek: 0.5 });
  });

  it('sorts weeks and entries regardless of input order', () => {
    const summaries = buildWeeklySummaries([log('2026-10-06', 71), log('2026-09-28', 70), log('2026-10-04', 71.2)]);
    expect(summaries.map((s) => s.weekStart)).toEqual(['2026-09-27', '2026-10-04']);
    expect(summaries[1].entries.map((e) => e.date)).toEqual(['2026-10-04', '2026-10-06']);
  });

  it('skips weeks with no logs instead of inventing them', () => {
    const summaries = buildWeeklySummaries([log('2026-09-14', 70), log('2026-10-05', 71)]);
    expect(summaries).toHaveLength(2);
    expect(summaries[1].deltaFromPreviousWeek).toBe(1);
  });

  it('returns nothing for an empty log', () => {
    expect(buildWeeklySummaries([])).toEqual([]);
  });
});

describe('findWeightNearDate / estimateWeightForDate', () => {
  const logs = [log('2026-10-01', 70), log('2026-10-10', 71)];

  it('prefers an exact match', () => {
    expect(findWeightNearDate(logs, '2026-10-10')).toBe(71);
  });

  it('falls back to the closest weigh-in within a week, otherwise nothing', () => {
    expect(findWeightNearDate(logs, '2026-10-04')).toBe(70);
    expect(findWeightNearDate(logs, '2026-10-08')).toBe(71);
    expect(findWeightNearDate(logs, '2026-10-20')).toBeUndefined();
  });

  it("uses that date's weekly average when the week has data, to smooth daily swings", () => {
    const week = [log('2026-10-04', 70), log('2026-10-06', 71), log('2026-10-08', 72)];
    expect(estimateWeightForDate(week, '2026-10-05')).toBe(71);
  });

  it('falls back to the nearest weigh-in when the week itself is empty', () => {
    expect(estimateWeightForDate([log('2026-09-30', 69.5)], '2026-10-04')).toBe(69.5);
  });
});
