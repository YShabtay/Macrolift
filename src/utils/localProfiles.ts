import type { AppState, UserMetrics, UserProfile } from '../types/fitness';
import { storageService, type AuthUser } from '../services/storageService';
import { calculateNutritionPlan } from './calculations';
import { getWorkoutTemplate, suggestSplitType } from '../data/workoutTemplates';
import { adaptWorkoutPlan } from './workoutAdaptation';
import { parseBackupFile, type RestoreSummary } from './backupValidation';
import { GUEST_USER_ID } from './guestSession';

/**
 * Local-first profiles: a profile that lives only on this device, with no password and no server.
 * They're stored as `AuthUser` records with an empty `passwordHash` (which no typed password can ever
 * match), so they can't be "logged into" through the form - the sign-in screen lists them for one-tap
 * re-entry instead, which keeps a guest or restored profile from being locked out after logging out.
 */

export function isLocalProfile(user: AuthUser): boolean {
  return user.passwordHash === '';
}

/** Signs in to a passwordless on-device profile. */
export async function openLocalProfile(userId: string): Promise<string> {
  await storageService.setSessionUserId(userId);
  return userId;
}

/** A complete set of defaults, so the nutrition and workout engines always have valid numbers to work with. */
const GUEST_METRICS: UserMetrics = {
  gender: 'male',
  age: 25,
  heightCm: 175,
  weightKg: 70,
  averageDailySteps: 6000,
  trainingDaysPerWeek: 3,
  bodyState: 'athletic',
  goal: 'maintain',
  goalIntensity: 'moderate',
  targetFocus: 'balanced',
};

function buildGuestAppState(userId: string): AppState {
  const metrics = GUEST_METRICS;
  const split = suggestSplitType(metrics.trainingDaysPerWeek);
  const profile: UserProfile = { id: userId, name: 'אורח', createdAt: new Date().toISOString(), metrics, isGuest: true };
  return {
    profile,
    nutritionPlan: calculateNutritionPlan(metrics),
    workoutPlan: adaptWorkoutPlan(getWorkoutTemplate(split, metrics.trainingDaysPerWeek), metrics.experience, metrics.targetFocus, metrics.gender).plan,
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

/**
 * Opens the device's guest profile, creating whatever is missing: the user record, a full default profile, or both. Safe to call
 * on every launch - existing guest data is never replaced, but a guest whose record or data went missing (cleared storage, a lost
 * session pointer) comes back as a working guest instead of leaving the app stuck.
 */
export async function ensureGuestSession(): Promise<string> {
  const users = await storageService.getUsers();
  if (!users.some((u) => u.id === GUEST_USER_ID)) {
    const guest: AuthUser = {
      id: GUEST_USER_ID,
      fullName: 'אורח',
      username: 'local-guest',
      email: '',
      passwordHash: '',
      createdAt: new Date().toISOString(),
    };
    await storageService.saveUsers([...users, guest]);
  }
  if (!(await storageService.getAppState(GUEST_USER_ID))) {
    await storageService.saveAppState(GUEST_USER_ID, buildGuestAppState(GUEST_USER_ID));
  }
  await storageService.setSessionUserId(GUEST_USER_ID); // also sets the macrolift_is_guest flag
  return GUEST_USER_ID;
}

/** One-tap entry: opens the guest profile (creating it the first time). */
export function startGuestSession(): Promise<string> {
  return ensureGuestSession();
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
