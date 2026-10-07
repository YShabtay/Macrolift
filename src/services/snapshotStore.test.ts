import { describe, expect, it } from 'vitest';
import type { AppState } from '../types/fitness';
import {
  createSnapshotStore,
  DAILY_KEEP,
  DAILY_REFRESH_MS,
  hasMeaningfulData,
  SAFETY_KEEP,
  type Snapshot,
  type SnapshotBackend,
} from './snapshotStore';
import { pickRestorableSnapshot, stateFromSnapshot } from '../utils/snapshotRestore';

function memoryBackend(): SnapshotBackend & { items: Map<string, Snapshot> } {
  const items = new Map<string, Snapshot>();
  return {
    items,
    async getAll() {
      return [...items.values()];
    },
    async put(s) {
      items.set(s.id, s);
    },
    async remove(id) {
      items.delete(id);
    },
  };
}

const DAY = 24 * 60 * 60 * 1000;

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    profile: { id: 'u1', name: 'דוגמה', createdAt: '2026-01-01T00:00:00.000Z', metrics: {} as AppState['profile']['metrics'] },
    nutritionPlan: {} as AppState['nutritionPlan'],
    workoutPlan: {} as AppState['workoutPlan'],
    progress: [],
    weightLogs: [{ id: 'w1', date: '2026-01-02', weightKg: 70 }] as AppState['weightLogs'],
    progressPhotos: [{ id: 'p1', date: '2026-01-02', photoUrl: 'data:image/jpeg;base64,AAAA' }],
    schedule: [],
    foodLog: [],
    stepLogs: [],
    circumferenceLogs: [],
    circumferenceGoals: {},
    ...overrides,
  };
}

const emptyState = () => makeState({ weightLogs: [], progressPhotos: [] });

function setup(start = new Date(2026, 5, 10, 9, 0).getTime()) {
  const backend = memoryBackend();
  let t = start;
  const store = createSnapshotStore(backend, () => t);
  return { backend, store, advance: (ms: number) => (t += ms), now: () => t };
}

describe('snapshotStore', () => {
  it('skips profiles with nothing tracked', async () => {
    const { store, backend } = setup();
    expect(hasMeaningfulData(emptyState())).toBe(false);
    expect(await store.saveDaily('u1', emptyState())).toBe(false);
    expect(await store.saveSafety('u1', emptyState(), 'before-reset')).toBeNull();
    expect(backend.items.size).toBe(0);
  });

  it('daily copies leave photos out', async () => {
    const { store } = setup();
    await store.saveDaily('u1', makeState());
    const [snap] = await store.list('u1');
    expect(snap.state.progressPhotos).toEqual([]);
    expect(snap.hasPhotos).toBe(false);
    expect(snap.summary.weightLogs).toBe(1);
  });

  it('refreshes the same day at most every few hours', async () => {
    const { store, advance, backend } = setup();
    expect(await store.saveDaily('u1', makeState())).toBe(true);
    advance(60 * 60 * 1000);
    expect(await store.saveDaily('u1', makeState())).toBe(false);
    advance(DAILY_REFRESH_MS);
    expect(await store.saveDaily('u1', makeState())).toBe(true);
    expect(backend.items.size).toBe(1);
  });

  it('keeps one daily copy per day and only the last week', async () => {
    const { store, advance } = setup();
    for (let i = 0; i < DAILY_KEEP + 3; i++) {
      await store.saveDaily('u1', makeState());
      advance(DAY);
    }
    expect(await store.list('u1')).toHaveLength(DAILY_KEEP);
  });

  it('safety copies keep photos and have their own, separate limit', async () => {
    const { store, advance } = setup();
    for (let i = 0; i < SAFETY_KEEP + 2; i++) {
      await store.saveSafety('u1', makeState(), 'before-reset');
      advance(1000);
    }
    await store.saveDaily('u1', makeState());
    const all = await store.list('u1');
    expect(all.filter((s) => s.reason === 'before-reset')).toHaveLength(SAFETY_KEEP);
    expect(all.filter((s) => s.reason === 'daily')).toHaveLength(1);
    expect(all.find((s) => s.reason === 'before-reset')?.hasPhotos).toBe(true);
  });

  it('never mixes profiles when pruning or listing', async () => {
    const { store } = setup();
    await store.saveDaily('u1', makeState());
    await store.saveDaily('u2', makeState());
    expect(await store.list('u1')).toHaveLength(1);
    expect(await store.list()).toHaveLength(2);
    await store.removeAllFor('u1');
    expect((await store.list()).map((s) => s.userId)).toEqual(['u2']);
  });
});

describe('snapshot restore policy', () => {
  it('offers the newest meaningful snapshot after the last dismissal', async () => {
    const { store, advance } = setup();
    await store.saveDaily('u1', makeState());
    advance(DAY);
    await store.saveDaily('u1', makeState({ weightLogs: [{ id: 'w2', date: '2026-01-03', weightKg: 71 }] as AppState['weightLogs'] }));
    const snaps = await store.list('u1');
    const picked = pickRestorableSnapshot(snaps, 'u1', () => 0);
    expect(picked?.id).toBe(snaps[0].id);
    expect(pickRestorableSnapshot(snaps, 'u1', () => snaps[0].createdAt)).toBeNull();
    expect(pickRestorableSnapshot(snaps, 'other', () => 0)).toBeNull();
  });

  it('keeps photos on the device when restoring a daily copy', async () => {
    const { store } = setup();
    await store.saveDaily('u1', makeState());
    const [snap] = await store.list('u1');
    const current = makeState();
    const restored = stateFromSnapshot(snap, current);
    expect(restored?.progressPhotos).toEqual(current.progressPhotos);
  });
});
