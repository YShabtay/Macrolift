import { describe, expect, it } from 'vitest';
import type { StepLog } from '../types/fitness';
import { describeStepSurplus, getStepSurplus } from './stepSurplus';

// 2026-10-04 is a Sunday: the week so far is Sunday, Monday, and today, Tuesday.
const steps = (date: string, count: number): StepLog => ({ date, steps: count });
const surplus = (logs: StepLog[], goalSteps = 4500, weightKg = 70) => getStepSurplus({ stepLogs: logs, goalSteps, weightKg, today: '2026-10-06' });

describe('getStepSurplus', () => {
  it('says how much more is burned than the target assumes when the week so far is above the goal', () => {
    const s = surplus([steps('2026-10-04', 6770), steps('2026-10-05', 6832)]);
    expect(s?.days).toBe(2);
    expect(s?.averageSteps).toBe(6801);
    expect(s?.diffSteps).toBe(2301);
    expect(s?.kcalPerDay).toBe(92); // 2,301 steps x 0.04 at 70 kg
  });

  it('says so too when the week is below the goal', () => {
    const s = surplus([steps('2026-10-04', 3000), steps('2026-10-05', 3500)]);
    expect(s?.diffSteps).toBe(-1250);
    expect(s?.kcalPerDay).toBe(-50);
  });

  it('counts a slow day against a fast one, so only the average matters', () => {
    const s = surplus([steps('2026-10-04', 8846), steps('2026-10-05', 3818)]);
    expect(s?.averageSteps).toBe(6332);
    expect(s?.kcalPerDay).toBeGreaterThan(0);
  });

  it('scales with body weight', () => {
    const light = surplus([steps('2026-10-04', 7000), steps('2026-10-05', 7000)], 4500, 50)?.kcalPerDay ?? 0;
    const heavy = surplus([steps('2026-10-04', 7000), steps('2026-10-05', 7000)], 4500, 100)?.kcalPerDay ?? 0;
    expect(heavy).toBeGreaterThan(light);
  });

  it('stays quiet without enough days, when the difference is small, and ignores today and earlier weeks', () => {
    expect(surplus([steps('2026-10-05', 9000)])).toBeNull(); // one day is not an average
    expect(surplus([steps('2026-10-04', 4600), steps('2026-10-05', 4700)])).toBeNull(); // about 100 steps over: nothing to say
    expect(surplus([steps('2026-10-06', 9000), steps('2026-10-05', 9000)])).toBeNull(); // today's count is still growing
    expect(surplus([steps('2026-09-28', 9000), steps('2026-09-29', 9000), steps('2026-10-05', 9000)])).toBeNull(); // last week does not count
  });

  it('skips days without a count instead of treating them as zero steps', () => {
    const s = surplus([steps('2026-10-04', 7000), steps('2026-10-05', 7000)]);
    expect(s?.averageSteps).toBe(7000);
  });
});

describe('describeStepSurplus', () => {
  it('tells the person to eat more when they walked more, with the amount', () => {
    const text = describeStepSurplus(surplus([steps('2026-10-04', 6770), steps('2026-10-05', 6832)])!);
    expect(text).toContain('6,801');
    expect(text).toContain('יותר מהיעד');
    expect(text).toContain('90');
  });

  it('tells the person the opposite when they walked less', () => {
    const text = describeStepSurplus(surplus([steps('2026-10-04', 3000), steps('2026-10-05', 3500)])!);
    expect(text).toContain('פחות מהיעד');
  });
});
