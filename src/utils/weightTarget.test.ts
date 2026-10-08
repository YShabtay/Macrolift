import { describe, expect, it } from 'vitest';
import type { UserMetrics, WeightLog } from '../types/fitness';
import { getCurrentWeight, getWeightTargetProgress, getStartWeight, validateWeightTarget, withTargetWeightBookkeeping } from './weightTarget';
import { mergeProfile } from './backupValidation';

const metrics = (over: Partial<UserMetrics> = {}): UserMetrics =>
  ({ gender: 'male', age: 29, heightCm: 170, weightKg: 69, averageDailySteps: 4500, trainingDaysPerWeek: 3, goal: 'gain_muscle', goalIntensity: 'moderate', targetWeightKg: 72, targetWeightStartKg: 69, ...over }) as UserMetrics;
const log = (date: string, weightKg: number): WeightLog => ({ id: date, date, weightKg });
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);
/** One weigh-in a day from `from`, weight rising by `perWeek` kg a week from `start`. */
const series = (from: string, days: number, start: number, perWeek: number) => Array.from({ length: days }, (_, i) => log(addDays(from, i), Math.round((start + (perWeek * i) / 7) * 100) / 100));

describe('validateWeightTarget', () => {
  const base = { currentKg: 69, heightCm: 170 };
  it('rejects a target on the wrong side of the goal', () => {
    expect(validateWeightTarget({ ...base, targetKg: 66, goal: 'gain_muscle' }).ok).toBe(false);
    expect(validateWeightTarget({ ...base, targetKg: 72, goal: 'lose_weight' }).ok).toBe(false);
    expect(validateWeightTarget({ ...base, targetKg: 72, goal: 'gain_muscle' }).ok).toBe(true);
    expect(validateWeightTarget({ ...base, targetKg: 66, goal: 'lose_weight' }).ok).toBe(true);
  });
  it('rejects numbers outside a human range', () => {
    expect(validateWeightTarget({ ...base, targetKg: 20, goal: 'recomp' }).ok).toBe(false);
    expect(validateWeightTarget({ ...base, targetKg: Number.NaN, goal: 'recomp' }).ok).toBe(false);
  });
  it('warns, without blocking, on a target below a healthy BMI or far from a maintain goal', () => {
    expect(validateWeightTarget({ ...base, targetKg: 52, goal: 'lose_weight' })).toMatchObject({ ok: true, warning: expect.any(String) });
    expect(validateWeightTarget({ ...base, targetKg: 75, goal: 'maintain' })).toMatchObject({ ok: true, warning: expect.any(String) });
    expect(validateWeightTarget({ ...base, targetKg: 71, goal: 'maintain' }).warning).toBeUndefined();
  });
});

describe('getCurrentWeight', () => {
  it('averages the last 7 days, falling back to the latest weigh-in and then the profile', () => {
    const logs = [log('2026-10-01', 68), log('2026-10-05', 69), log('2026-10-07', 70)];
    expect(getCurrentWeight(logs, 60, '2026-10-08')).toEqual({ kg: 69.5, basis: 'week-average' }); // 10-02..10-08
    expect(getCurrentWeight(logs, 60, '2026-10-20')).toEqual({ kg: 70, basis: 'latest' });
    expect(getCurrentWeight([], 60, '2026-10-08')).toEqual({ kg: 60, basis: 'profile' });
  });
  it('uses the weight saved with the target as the start, else the first weigh-in', () => {
    expect(getStartWeight(metrics({ targetWeightStartKg: 68 }), [log('2026-09-01', 67)])).toBe(68);
    expect(getStartWeight(metrics({ targetWeightStartKg: undefined }), [log('2026-09-10', 70), log('2026-09-01', 67)])).toBe(67);
  });
});

describe('getWeightTargetProgress', () => {
  it('is null without a target', () => {
    expect(getWeightTargetProgress({ metrics: metrics({ targetWeightKg: undefined }), weightLogs: [], today: '2026-10-08' })).toBeNull();
  });

  it('shows the remaining kilos and percent, and a lean-bulk estimate before there is a trend (69 to 72 kg)', () => {
    const p = getWeightTargetProgress({ metrics: metrics(), weightLogs: [log('2026-10-06', 69.6), log('2026-10-07', 69.8)], today: '2026-10-08' })!;
    expect(p.status).toBe('active');
    expect(p.direction).toBe('gain');
    expect(p.currentKg).toBe(69.7);
    expect(p.remainingKg).toBe(2.3);
    expect(p.percent).toBe(23);
    expect(p.trend).toBe('unknown');
    expect(p.eta).toMatchObject({ basis: 'expected' });
    expect(p.eta!.minWeeks).toBeLessThan(p.eta!.maxWeeks!);
  });

  it('uses the measured pace once there are enough weigh-ins', () => {
    const logs = series('2026-09-10', 28, 69, 0.3).map((l, i) => ({ ...l, weightKg: l.weightKg + (i % 2 ? 0.1 : -0.1) }));
    const p = getWeightTargetProgress({ metrics: metrics({ targetWeightKg: 75 }), weightLogs: logs, today: '2026-10-07' })!;
    expect(p.trend).toBe('toward');
    expect(p.paceKgPerWeek).toBeGreaterThan(0.2);
    expect(p.eta?.basis).toBe('measured');
  });

  it('notices a trend that moves away from the target and gives no estimate from it', () => {
    const logs = series('2026-09-10', 28, 70, -0.3);
    const p = getWeightTargetProgress({ metrics: metrics({ goal: 'recomp' }), weightLogs: logs, today: '2026-10-07' })!;
    expect(p.trend).toBe('away');
    expect(p.eta).toBeNull();
  });

  it('is reached only after two weeks in a row whose averages are at the target', () => {
    // Weeks (Sunday start): 9/27 avg 70, 10/4 avg 72.1. Only one week at the target so far.
    const oneWeek = [log('2026-09-28', 70), log('2026-09-30', 70), log('2026-10-05', 72.1), log('2026-10-07', 72.1)];
    expect(getWeightTargetProgress({ metrics: metrics(), weightLogs: oneWeek, today: '2026-10-08' })).toMatchObject({ status: 'active', weeksAtTarget: 1 });
    const twoWeeks = [log('2026-09-28', 72), log('2026-09-30', 72.2), log('2026-10-05', 72.1), log('2026-10-07', 72.1)];
    const p = getWeightTargetProgress({ metrics: metrics(), weightLogs: twoWeeks, today: '2026-10-08' })!;
    expect(p).toMatchObject({ status: 'reached', percent: 100, remainingKg: 0, weeksAtTarget: 2 });
    expect(p.eta).toBeNull();
  });

  it('a week with a single weigh-in does not count toward reaching it', () => {
    const logs = [log('2026-09-28', 72), log('2026-09-30', 72.2), log('2026-10-05', 72.4)];
    expect(getWeightTargetProgress({ metrics: metrics(), weightLogs: logs, today: '2026-10-08' })!.status).toBe('active');
  });

  it('works for losing weight: below the target counts as reached', () => {
    const m = metrics({ goal: 'lose_weight', targetWeightKg: 66, targetWeightStartKg: 70 });
    const logs = [log('2026-09-28', 66.1), log('2026-09-30', 65.9), log('2026-10-05', 65.8), log('2026-10-07', 66)];
    const p = getWeightTargetProgress({ metrics: m, weightLogs: logs, today: '2026-10-08' })!;
    expect(p.direction).toBe('lose');
    expect(p.status).toBe('reached');
  });
});

describe('withTargetWeightBookkeeping', () => {
  const logs = [log('2026-10-05', 69.4), log('2026-10-07', 69.6)];
  const noTarget = metrics({ targetWeightKg: undefined, targetWeightStartKg: undefined });

  it('records the current weekly average as the start when a target is set', () => {
    expect(withTargetWeightBookkeeping(noTarget, { targetWeightKg: 72 }, logs, '2026-10-08')).toEqual({ targetWeightKg: 72, targetWeightStartKg: 69.5 });
  });
  it('keeps the original start when the target is unchanged, and restarts it when the target changes', () => {
    const had = metrics({ targetWeightKg: 72, targetWeightStartKg: 68 });
    expect(withTargetWeightBookkeeping(had, { age: 30 }, logs, '2026-10-08')).toEqual({ age: 30 });
    expect(withTargetWeightBookkeeping(had, { targetWeightKg: 74 }, logs, '2026-10-08')).toEqual({ targetWeightKg: 74, targetWeightStartKg: 69.5 });
  });
  it('clears the start together with the target', () => {
    expect(withTargetWeightBookkeeping(metrics(), { targetWeightKg: undefined }, logs, '2026-10-08')).toEqual({ targetWeightKg: undefined, targetWeightStartKg: undefined });
  });
  it('drops a target that the new goal contradicts', () => {
    const had = metrics({ targetWeightKg: 72, targetWeightStartKg: 69 });
    expect(withTargetWeightBookkeeping(had, { goal: 'lose_weight' }, logs, '2026-10-08')).toEqual({ goal: 'lose_weight', targetWeightKg: undefined, targetWeightStartKg: undefined });
  });
});

describe('backup keeps the target weight', () => {
  it('restores a valid target and its start, and ignores an impossible one', () => {
    const base = { id: 'u', name: 'x', createdAt: '2026-01-01T00:00:00.000Z', metrics: metrics({ targetWeightKg: undefined, targetWeightStartKg: undefined }) };
    const ok = mergeProfile(base as never, { metrics: { targetWeightKg: 72, targetWeightStartKg: 69 } });
    expect(ok.metrics).toMatchObject({ targetWeightKg: 72, targetWeightStartKg: 69 });
    const bad = mergeProfile(base as never, { metrics: { targetWeightKg: 5, targetWeightStartKg: 69 } });
    expect(bad.metrics.targetWeightKg).toBeUndefined();
    expect(bad.metrics.targetWeightStartKg).toBeUndefined();
  });
});
