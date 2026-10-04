import type { AppState } from '../types/fitness';
import { storageService } from '../services/storageService';
import { todayIso } from './weightCalculations';

/** True when there is anything the user entered that would be lost by switching browsers/devices (not just a fresh profile). */
export function hasTrackedData(state: AppState): boolean {
  return (
    state.foodLog.length > 0 ||
    state.weightLogs.length > 0 ||
    state.progress.length > 0 ||
    state.progressPhotos.length > 0 ||
    state.stepLogs.length > 0 ||
    state.circumferenceLogs.length > 0 ||
    (state.completedWorkoutDates?.length ?? 0) > 0
  );
}

/** A meal or a workout has been logged - the point where moving to the home-screen app starts to put real data at risk. */
export function hasLoggedMealOrWorkout(state: AppState): boolean {
  return state.foodLog.length > 0 || state.progress.length > 0 || (state.completedWorkoutDates?.length ?? 0) > 0;
}

const LAST_BACKUP_KEY = 'macrolift-last-backup-at';
const REMINDER_SNOOZED_AT_KEY = 'macrolift-backup-reminder-snoozed-at';
const DAY_MS = 24 * 60 * 60 * 1000;
/** A profile has to be this old, with data in it, before the first backup reminder appears. */
const FIRST_REMINDER_AFTER_DAYS = 3;
/** After a backup, the next reminder comes this many days later. */
const REMINDER_EVERY_DAYS = 14;
/** "Remind me later" hides the reminder for this long. */
const SNOOZE_DAYS = 3;

function readTimestamp(key: string): number | null {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeTimestamp(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked: the reminder just comes back sooner.
  }
}

/** When this device last exported a backup (ms), or null if it never did. */
export function getLastBackupAt(): number | null {
  return readTimestamp(LAST_BACKUP_KEY);
}

export function daysSince(timestamp: number, now: number = Date.now()): number {
  return Math.floor((now - timestamp) / DAY_MS);
}

/**
 * Whether to nudge the user to back up: there is data worth saving and either no backup was ever made (once the profile is a few days old)
 * or the last one is two weeks old. "Remind me later" quiets it for a few days.
 */
export function shouldShowBackupReminder(state: AppState, now: number = Date.now()): boolean {
  if (!hasTrackedData(state)) return false;
  const snoozedAt = readTimestamp(REMINDER_SNOOZED_AT_KEY);
  if (snoozedAt !== null && now - snoozedAt < SNOOZE_DAYS * DAY_MS) return false;
  const lastBackup = getLastBackupAt();
  if (lastBackup !== null) return daysSince(lastBackup, now) >= REMINDER_EVERY_DAYS;
  const createdAt = Date.parse(state.profile.createdAt);
  return !Number.isFinite(createdAt) || daysSince(createdAt, now) >= FIRST_REMINDER_AFTER_DAYS;
}

export function snoozeBackupReminder(now: number = Date.now()): void {
  writeTimestamp(REMINDER_SNOOZED_AT_KEY, now);
}

async function buildBackupFile(appState: AppState): Promise<File> {
  const [customFoods, customExerciseVideos] = await Promise.all([storageService.getCustomFoods(), storageService.getCustomExerciseVideos()]);
  const payload = { version: 2, exportedAt: new Date().toISOString(), appState, customFoods, customExerciseVideos };
  return new File([JSON.stringify(payload, null, 2)], `macrolift-backup-${todayIso()}.json`, { type: 'application/json' });
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type BackupExportResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Exports everything the app keeps on this device as `macrolift-backup-[date].json`: the whole app state (profile, nutrition, workouts,
 * weigh-ins, photos, steps...) plus the user's own foods and exercise-video links, which live outside the app state.
 * Where the browser can share files (iPhone / Android) the system share sheet opens, so the file can go straight to AirDrop, WhatsApp or
 * "Save to Files"; elsewhere it downloads. Remembers the time of a successful backup for the reminder.
 */
export async function exportBackup(appState: AppState): Promise<BackupExportResult> {
  const file = await buildBackupFile(appState);

  if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'גיבוי MacroLift' });
      writeTimestamp(LAST_BACKUP_KEY, Date.now());
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Any other share failure falls through to a plain download.
    }
  }

  downloadFile(file);
  writeTimestamp(LAST_BACKUP_KEY, Date.now());
  return 'downloaded';
}
