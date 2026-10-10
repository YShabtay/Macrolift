import { describe, expect, it } from 'vitest';
import type { AppState, GoalPhase, ProgressPhoto, WeightLog } from '../types/fitness';
import { describePhase, filterLogsToPhase, getEffectivePhases, getPhaseStats, photosForPhase, sanitizePhases, trackGoalChange, validatePhases } from './phases';

const TODAY = '2026-10-10';
const weigh = (date: string, weightKg: number): WeightLog => ({ id: date, date, weightKg });
const photo = (date: string): ProgressPhoto => ({ id: `p-${date}`, date, photoUrl: 'x', weightKg: 70 });
const stateOf = (goal: AppState['profile']['metrics']['goal'], extra: Partial<AppState> = {}) =>
  ({ profile: { createdAt: '2026-03-01T08:00:00.000Z', metrics: { goal } }, weightLogs: [], ...extra }) as unknown as AppState;

describe('getEffectivePhases', () => {
  it('derives one open period from the current goal when none were saved, starting at the first weigh-in', () => {
    const phases = getEffectivePhases(stateOf('gain_muscle', { weightLogs: [weigh('2026-03-15', 66.5), weigh('2026-09-20', 68.8)] }), TODAY);
    expect(phases).toEqual([{ id: 'derived-current', goal: 'gain_muscle', startDate: '2026-03-15' }]);
  });

  it('falls back to the day the profile was made when there are no weigh-ins', () => {
    expect(getEffectivePhases(stateOf('lose_weight'), TODAY)[0].startDate).toBe('2026-03-01');
  });

  it('uses saved periods in order, and closes the open one yesterday when the goal moved without being tracked', () => {
    const saved: GoalPhase[] = [
      { id: 'b', goal: 'gain_muscle', startDate: '2026-10-01' },
      { id: 'a', goal: 'lose_weight', startDate: '2026-03-15', endDate: '2026-09-30' },
    ];
    expect(getEffectivePhases(stateOf('gain_muscle', { phases: saved }), TODAY).map((p) => p.id)).toEqual(['a', 'b']);
    const moved = getEffectivePhases(stateOf('maintain', { phases: saved }), TODAY);
    expect(moved).toHaveLength(3);
    expect(moved[1]).toMatchObject({ id: 'b', endDate: '2026-10-09' });
    expect(moved[2]).toMatchObject({ goal: 'maintain', startDate: TODAY });
  });
});

describe('trackGoalChange', () => {
  const cut: GoalPhase = { id: 'cut', goal: 'lose_weight', startDate: '2026-03-15' };

  it('closes the open period the day before and starts a new one today when the goal changes', () => {
    const prev = stateOf('lose_weight', { phases: [cut] });
    const next = trackGoalChange(prev, stateOf('gain_muscle'), TODAY);
    expect(next.phases?.[0]).toEqual({ ...cut, endDate: '2026-10-09' });
    expect(next.phases?.[1]).toMatchObject({ goal: 'gain_muscle', startDate: TODAY });
    expect(next.phases?.[1].endDate).toBeUndefined();
  });

  it('keeps the periods when the goal did not change', () => {
    const next = stateOf('lose_weight');
    expect(trackGoalChange(stateOf('lose_weight', { phases: [cut] }), next, TODAY)).toBe(next);
  });

  it('records the old period too for someone who never had any saved', () => {
    const prev = stateOf('lose_weight', { weightLogs: [weigh('2026-03-15', 66.5)] });
    const next = trackGoalChange(prev, stateOf('gain_muscle'), TODAY);
    expect(next.phases?.map((p) => [p.goal, p.startDate, p.endDate])).toEqual([
      ['lose_weight', '2026-03-15', '2026-10-09'],
      ['gain_muscle', TODAY, undefined],
    ]);
  });

  it('changes the goal of a period that started today instead of leaving an empty one', () => {
    const today: GoalPhase = { id: 't', goal: 'lose_weight', startDate: TODAY };
    const next = trackGoalChange(stateOf('lose_weight', { phases: [today] }), stateOf('maintain'), TODAY);
    expect(next.phases).toHaveLength(1);
    expect(next.phases?.[0]).toMatchObject({ goal: 'maintain', startDate: TODAY });
  });
});

describe('what a period shows', () => {
  const cut: GoalPhase = { id: 'cut', goal: 'lose_weight', startDate: '2026-03-15', endDate: '2026-09-30' };
  const bulk: GoalPhase = { id: 'bulk', goal: 'gain_muscle', startDate: '2026-10-01' };

  it('keeps the weigh-ins inside it, an open period running to today', () => {
    const logs = [weigh('2026-03-14', 70), weigh('2026-03-15', 69), weigh('2026-09-30', 66.5), weigh('2026-10-01', 66.6), weigh('2026-10-10', 67)];
    expect(filterLogsToPhase(logs, cut, TODAY).map((w) => w.date)).toEqual(['2026-03-15', '2026-09-30']);
    expect(filterLogsToPhase(logs, bulk, TODAY).map((w) => w.date)).toEqual(['2026-10-01', '2026-10-10']);
  });

  it('shows the photos of the period plus the last one before it as the starting point', () => {
    const photos = [photo('2026-03-15'), photo('2026-09-20'), photo('2026-10-05')];
    const forBulk = photosForPhase(photos, bulk, TODAY);
    expect(forBulk.photos.map((p) => p.date)).toEqual(['2026-09-20', '2026-10-05']);
    expect(forBulk.baselineId).toBe('p-2026-09-20');
    const forCut = photosForPhase(photos, cut, TODAY);
    expect(forCut.photos.map((p) => p.date)).toEqual(['2026-03-15', '2026-09-20']);
    expect(forCut.baselineId).toBeNull();
  });

  it('shows only the starting photo when none was taken in the period yet', () => {
    expect(photosForPhase([photo('2026-09-20')], bulk, TODAY).photos.map((p) => p.date)).toEqual(['2026-09-20']);
  });

  it('describes the weight story with the first and last weekly average', () => {
    // Week of 2026-03-15 averages 70, the week of 2026-03-22 averages 69.4.
    const stats = getPhaseStats([weigh('2026-03-15', 70), weigh('2026-03-23', 69.4)]);
    expect(stats).toEqual({ weeks: 2, startAverageKg: 70, endAverageKg: 69.4, changeKg: -0.6 });
    expect(getPhaseStats([])).toEqual({ weeks: 0, startAverageKg: null, endAverageKg: null, changeKg: null });
  });

  it('names a period with its months', () => {
    expect(describePhase(cut)).toBe('חיטוב 03.2026 - 09.2026');
    expect(describePhase(bulk)).toBe('מסה מ-10.2026');
  });
});

describe('validatePhases', () => {
  const cut: GoalPhase = { id: 'cut', goal: 'lose_weight', startDate: '2026-03-15', endDate: '2026-09-30' };
  const bulk: GoalPhase = { id: 'bulk', goal: 'gain_muscle', startDate: '2026-10-01' };

  it('accepts ordered periods where only the last is open', () => {
    expect(validatePhases([cut, bulk])).toBeNull();
    expect(validatePhases([bulk])).toBeNull();
  });

  it('rejects an empty list, an end before the start, an open period that is not last, and overlaps', () => {
    expect(validatePhases([])).not.toBeNull();
    expect(validatePhases([{ ...cut, endDate: '2026-03-01' }])).not.toBeNull();
    expect(validatePhases([{ ...cut, endDate: undefined }, bulk])).not.toBeNull();
    expect(validatePhases([cut, { ...bulk, startDate: '2026-09-15' }])).not.toBeNull();
  });
});

describe('sanitizePhases (stored and restored data)', () => {
  it('keeps valid periods in order and drops junk entries', () => {
    const raw = [
      { id: 'b', goal: 'gain_muscle', startDate: '2026-10-01' },
      { id: 'a', goal: 'lose_weight', startDate: '2026-03-15', endDate: '2026-09-30' },
      { id: 'x', goal: 'fly', startDate: '2026-01-01' },
      'nope',
      { goal: 'maintain', startDate: '2026-02-01' },
    ];
    expect(sanitizePhases(raw)?.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('gives nothing back for data that is not usable or that overlaps, so the app derives the period from the goal', () => {
    expect(sanitizePhases(undefined)).toBeUndefined();
    expect(sanitizePhases([])).toBeUndefined();
    expect(sanitizePhases([{ id: 'a', goal: 'lose_weight', startDate: '2026-03-15', endDate: '2026-10-05' }, { id: 'b', goal: 'gain_muscle', startDate: '2026-10-01' }])).toBeUndefined();
  });
});
