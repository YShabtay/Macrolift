import type { AppState } from '../types/fitness';
import { sanitizeAppState } from './dataMigration';
import { hasMeaningfulData, type Snapshot } from '../services/snapshotStore';

const DISMISSED_KEY_PREFIX = 'macrolift-snapshot-dismissed-';

function dismissedKey(userId: string): string {
  return `${DISMISSED_KEY_PREFIX}${userId}`;
}

/** When the user last said "no thanks, start fresh" (or deliberately reset) for this profile; 0 if never. */
export function getSnapshotDismissedAt(userId: string): number {
  try {
    const raw = localStorage.getItem(dismissedKey(userId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function markSnapshotsDismissed(userId: string, at: number = Date.now()): void {
  try {
    localStorage.setItem(dismissedKey(userId), String(at));
  } catch {
    // Storage blocked: the prompt may reappear, which is harmless.
  }
}

/**
 * The newest snapshot worth offering when data looks lost. Snapshots taken before the user's last "start fresh" / reset are not
 * offered again automatically (they stay available in the profile's list); `userId` limits the search to one profile.
 */
export function pickRestorableSnapshot(
  snapshots: Snapshot[],
  userId?: string,
  dismissedAt: (userId: string) => number = getSnapshotDismissedAt,
): Snapshot | null {
  const eligible = snapshots
    .filter((s) => (!userId || s.userId === userId) && hasMeaningfulData(s.state) && s.createdAt > dismissedAt(s.userId))
    .sort((a, b) => b.createdAt - a.createdAt);
  return eligible[0] ?? null;
}

/**
 * The state to put back from a snapshot: normalized like any loaded data. Daily snapshots carry no photos, so photos currently on
 * the device are kept rather than wiped by a restore.
 */
export function stateFromSnapshot(snapshot: Snapshot, current: AppState | null): AppState | null {
  const restored = sanitizeAppState(snapshot.state);
  if (!restored) return null;
  if (!snapshot.hasPhotos && current && current.progressPhotos.length > 0) {
    return { ...restored, progressPhotos: current.progressPhotos };
  }
  return restored;
}

export const SNAPSHOT_REASON_LABELS: Record<Snapshot['reason'], string> = {
  daily: 'גיבוי יומי',
  'before-reset': 'לפני איפוס',
  'before-import': 'לפני ייבוא גיבוי',
  'before-restore': 'לפני שחזור',
};

export function formatSnapshotDate(ms: number): string {
  return new Date(ms).toLocaleString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function describeSnapshot(snapshot: Snapshot): string {
  const { weightLogs, foodDays, workoutDays } = snapshot.summary;
  const parts = [
    weightLogs > 0 ? `${weightLogs} שקילות` : null,
    foodDays > 0 ? `${foodDays} ימי תזונה` : null,
    workoutDays > 0 ? `${workoutDays} ימי אימון` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'ללא רישומים';
}
