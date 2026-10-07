import type { AppState } from '../types/fitness';
import { hasTrackedData } from '../utils/backupExport';

/**
 * Automatic on-device safety copies of the user's data ("snapshots"), kept in IndexedDB - a different storage area than the
 * localStorage the app itself reads and writes. If localStorage is emptied or corrupted (a bug, a quota failure, a mistaken reset)
 * the snapshots are still there to restore from.
 *
 * Limit, stated plainly: IndexedDB belongs to the same browser origin, so clearing all site data, or the browser evicting the
 * site, removes snapshots together with the app data. Only a backup file (or, later, a cloud copy) survives that.
 */

export type SnapshotReason = 'daily' | 'before-reset' | 'before-import' | 'before-restore';

export interface Snapshot {
  id: string;
  userId: string;
  createdAt: number;
  reason: SnapshotReason;
  state: AppState;
  /** Daily copies leave the (large) progress photos out; safety copies taken before a destructive action keep them. */
  hasPhotos: boolean;
  summary: SnapshotSummary;
}

export interface SnapshotSummary {
  name: string;
  weightLogs: number;
  foodDays: number;
  workoutDays: number;
}

/** The few storage operations the store needs, so tests can use memory and the app uses IndexedDB. */
export interface SnapshotBackend {
  getAll(): Promise<Snapshot[]>;
  put(snapshot: Snapshot): Promise<void>;
  remove(id: string): Promise<void>;
}

export const DAILY_KEEP = 7;
export const SAFETY_KEEP = 3;
/** A day's snapshot is refreshed at most this often, so a busy day doesn't rewrite a large record on every edit. */
export const DAILY_REFRESH_MS = 3 * 60 * 60 * 1000;

/** True when the state holds anything a user would be sad to lose (an empty/fresh profile is not worth keeping a copy of). */
export function hasMeaningfulData(state: AppState | null | undefined): state is AppState {
  return !!state && hasTrackedData(state);
}

export function summarizeState(state: AppState): SnapshotSummary {
  return {
    name: state.profile.name,
    weightLogs: state.weightLogs.length,
    foodDays: new Set(state.foodLog.map((f) => f.date)).size,
    workoutDays: state.completedWorkoutDates?.length ?? 0,
  };
}

function localDateKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function createSnapshotStore(backend: SnapshotBackend, now: () => number = Date.now) {
  async function listForUser(userId: string): Promise<Snapshot[]> {
    return (await backend.getAll()).filter((s) => s.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }

  async function prune(userId: string, reason: 'daily' | 'safety'): Promise<void> {
    const mine = (await listForUser(userId)).filter((s) => (reason === 'daily') === (s.reason === 'daily'));
    const keep = reason === 'daily' ? DAILY_KEEP : SAFETY_KEEP;
    for (const old of mine.slice(keep)) await backend.remove(old.id);
  }

  return {
    /** Newest first; all profiles on the device, or one profile's. */
    async list(userId?: string): Promise<Snapshot[]> {
      const all = await backend.getAll();
      return all.filter((s) => !userId || s.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
    },

    async get(id: string): Promise<Snapshot | null> {
      return (await backend.getAll()).find((s) => s.id === id) ?? null;
    },

    /**
     * The routine copy: one per calendar day, refreshed at most every few hours, the last week kept. Empty profiles are skipped.
     * Returns true when a snapshot was written.
     */
    async saveDaily(userId: string, state: AppState): Promise<boolean> {
      if (!hasMeaningfulData(state)) return false;
      const t = now();
      const id = `daily-${userId}-${localDateKey(t)}`;
      const existing = (await backend.getAll()).find((s) => s.id === id);
      if (existing && t - existing.createdAt < DAILY_REFRESH_MS) return false;
      await backend.put({
        id,
        userId,
        createdAt: t,
        reason: 'daily',
        state: { ...state, progressPhotos: [] },
        hasPhotos: false,
        summary: summarizeState(state),
      });
      await prune(userId, 'daily');
      return true;
    },

    /** A full copy (photos included) taken right before something that overwrites or deletes data. Skipped for empty profiles. */
    async saveSafety(userId: string, state: AppState, reason: Exclude<SnapshotReason, 'daily'>): Promise<Snapshot | null> {
      if (!hasMeaningfulData(state)) return null;
      const t = now();
      const snapshot: Snapshot = {
        id: `${reason}-${userId}-${t}`,
        userId,
        createdAt: t,
        reason,
        state,
        hasPhotos: state.progressPhotos.length > 0,
        summary: summarizeState(state),
      };
      await backend.put(snapshot);
      await prune(userId, 'safety');
      return snapshot;
    },

    async remove(id: string): Promise<void> {
      await backend.remove(id);
    },

    /** Drops every snapshot of a profile (used when the user deletes it for good). */
    async removeAllFor(userId: string): Promise<void> {
      for (const s of await listForUser(userId)) await backend.remove(s.id);
    },
  };
}

export type SnapshotStore = ReturnType<typeof createSnapshotStore>;

// ---------------------------------------------------------------------------------------------------------------------
// IndexedDB backend. Every call is wrapped so a missing/blocked IndexedDB (private mode, old browsers) degrades to "no snapshots"
// instead of ever affecting the app.

const DB_NAME = 'macrolift-snapshots';
const STORE = 'snapshots';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

const indexedDbBackend: SnapshotBackend = {
  async getAll() {
    try {
      return await withStore<Snapshot[]>('readonly', (s) => s.getAll() as IDBRequest<Snapshot[]>);
    } catch {
      return [];
    }
  },
  async put(snapshot) {
    await withStore('readwrite', (s) => s.put(snapshot));
  },
  async remove(id) {
    await withStore('readwrite', (s) => s.delete(id));
  },
};

export const snapshotStore: SnapshotStore = createSnapshotStore(indexedDbBackend);
