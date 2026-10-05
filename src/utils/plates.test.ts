import { describe, expect, it } from 'vitest';
import { buildWarmupSets, getPlatesPerSide } from './plates';

describe('getPlatesPerSide', () => {
  it('loads the heaviest plates first on each side of a 20 kg bar', () => {
    expect(getPlatesPerSide(100)).toEqual({ perSide: [25, 15], leftoverKg: 0 });
    expect(getPlatesPerSide(60)).toEqual({ perSide: [20], leftoverKg: 0 });
    expect(getPlatesPerSide(142.5)).toEqual({ perSide: [25, 25, 10, 1.25], leftoverKg: 0 });
  });

  it('is just the bar when there is nothing to add', () => {
    expect(getPlatesPerSide(20)).toEqual({ perSide: [], leftoverKg: 0 });
    expect(getPlatesPerSide(10)).toEqual({ perSide: [], leftoverKg: 0 });
  });

  it("reports what the plates can't make instead of silently dropping it", () => {
    const load = getPlatesPerSide(21); // 0.5 kg per side is smaller than the smallest plate
    expect(load.perSide).toEqual([]);
    expect(load.leftoverKg).toBe(1);
  });

  it('respects a different bar weight', () => {
    expect(getPlatesPerSide(35, 15)).toEqual({ perSide: [10], leftoverKg: 0 });
  });

  it('always adds up to the requested weight when the load is exact', () => {
    for (const total of [45, 62.5, 87.5, 105, 137.5, 200]) {
      const { perSide, leftoverKg } = getPlatesPerSide(total);
      expect(20 + perSide.reduce((a, b) => a + b, 0) * 2 + leftoverKg).toBeCloseTo(total, 5);
    }
  });
});

describe('buildWarmupSets', () => {
  it('ramps from the empty bar to just under the working weight', () => {
    expect(buildWarmupSets(100)).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 50, reps: 5 },
      { weightKg: 70, reps: 3 },
      { weightKg: 85, reps: 1 },
    ]);
  });

  it('gives no warm-up for light loads or invalid input', () => {
    expect(buildWarmupSets(39)).toEqual([]);
    expect(buildWarmupSets(0)).toEqual([]);
    expect(buildWarmupSets(Number.NaN)).toEqual([]);
  });

  it('only has increasing weights, all below the working weight', () => {
    for (const working of [40, 42.5, 50, 60, 75, 120, 180]) {
      const sets = buildWarmupSets(working);
      sets.forEach((set, i) => {
        expect(set.weightKg).toBeLessThan(working);
        if (i > 0) expect(set.weightKg).toBeGreaterThan(sets[i - 1].weightKg);
      });
    }
  });
});
