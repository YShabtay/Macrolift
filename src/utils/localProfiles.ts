import type { AppState, UserMetrics, UserProfile } from '../types/fitness';
import { storageService, type AuthUser } from '../services/storageService';
import { calculateNutritionPlan } from './calculations';
import { getWorkoutTemplate, suggestSplitType } from '../data/workoutTemplates';
import { adaptWorkoutPlan } from './workoutAdaptation';
import { parseBackupFile, type RestoreSummary } from './backupValidation';

/**
 * Local-first profiles: a profile that lives only on this device, with no password and no server.
 * They're stored as `AuthUser` records with an empty `passwordHash` (which no typed password can ever
 * match), so they can't be "logged into" through the form - the sign-in screen lists them for one-tap
 * re-entry instead, which keeps a guest or restored profile from being locked out after logging out.
 */

export function isLocalProfile(user: AuthUser): boolean {
  return user.passwordHash === '';
}

async function createLocalUser(fullName: string): Promise<AuthUser> {
  const id = crypto.randomUUID();
  const user: AuthUser = {
    id,
    fullName,
    username: `local-${id.slice(0, 8)}`,
    email: '',
    passwordHash: '',
    createdAt: new Date().toISOString(),
  };
  const users = await storageService.getUsers();
  await storageService.saveUsers([...users, user]);
  return user;
}

/** Signs in to a passwordless on-device profile. */
export async function openLocalProfile(userId: string): Promise<string> {
  await storageService.setSessionUserId(userId);
  return userId;
}

const GUEST_METRICS: UserMetrics = {
  gender: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  averageDailySteps: 8000,
  trainingDaysPerWeek: 3,
  bodyState: 'athletic',
  goal: 'maintain',
  goalIntensity: 'moderate',
};

function buildGuestAppState(userId: string): AppState {
  const metrics = GUEST_METRICS;
  const split = suggestSplitType(metrics.trainingDaysPerWeek);
  const profile: UserProfile = { id: userId, name: 'אורח', createdAt: new Date().toISOString(), metrics };
  return {
    profile,
    nutritionPlan: calculateNutritionPlan(metrics),
    workoutPlan: adaptWorkoutPlan(getWorkoutTemplate(split, metrics.trainingDaysPerWeek), metrics.experience, metrics.targetFocus).plan,
    progress: [],
    weightLogs: [],
    progressPhotos: [],
    schedule: [],
    foodLog: [],
    stepLogs: [],
    circumferenceLogs: [],
    circumferenceGoals: {},
  };
}

/** One-tap entry: creates a basic on-device profile with sensible defaults (editable later) and opens it. */
export async function startGuestSession(): Promise<string> {
  const user = await createLocalUser('אורח');
  await storageService.saveAppState(user.id, buildGuestAppState(user.id));
  await storageService.setSessionUserId(user.id);
  return user.id;
}

export type RestoreOnboardingResult =
  | { ok: true; userId: string; summary: RestoreSummary; skipped: number }
  | { ok: false; error: string };

/**
 * Creates a new on-device profile from a MacroLift backup file chosen on the welcome screen. Nothing is
 * created unless the file holds a usable backup, and the user list/session are only touched after the
 * data itself was saved, so a failed restore leaves the device exactly as it was.
 */
export async function restoreProfileFromBackup(text: string): Promise<RestoreOnboardingResult> {
  const parsed = parseBackupFile(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.kind === 'weights') {
    return {
      ok: false,
      error: 'הקובץ מכיל רק שקילות, ללא פרופיל. כדי ליצור פרופיל חדש מגיבוי יש לבחור קובץ גיבוי מלא של MacroLift (JSON).',
    };
  }

  const id = crypto.randomUUID();
  try {
    const state: AppState = { ...parsed.state, profile: { ...parsed.state.profile, id } };
    await storageService.saveAppState(id, state);
    const user: AuthUser = {
      id,
      fullName: state.profile.name || 'משתמש משוחזר',
      username: `local-${id.slice(0, 8)}`,
      email: '',
      passwordHash: '',
      createdAt: new Date().toISOString(),
    };
    await storageService.saveUsers([...(await storageService.getUsers()), user]);
    await storageService.setSessionUserId(id);
    return { ok: true, userId: id, summary: parsed.summary, skipped: parsed.skippedEntries };
  } catch {
    await storageService.deleteAppState(id).catch(() => undefined);
    return { ok: false, error: 'לא ניתן היה לשמור את הנתונים במכשיר (ייתכן שהאחסון מלא או חסום). נסו שוב.' };
  }
}
