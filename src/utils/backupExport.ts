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

/**
 * Downloads everything the app keeps on this device as `macrolift-backup-[date].json`: the whole app state (profile, nutrition,
 * workouts, weigh-ins, photos, steps...) plus the user's own foods and exercise-video links, which live outside the app state.
 */
export async function downloadBackup(appState: AppState): Promise<void> {
  const [customFoods, customExerciseVideos] = await Promise.all([storageService.getCustomFoods(), storageService.getCustomExerciseVideos()]);
  const payload = { version: 2, exportedAt: new Date().toISOString(), appState, customFoods, customExerciseVideos };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `macrolift-backup-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
