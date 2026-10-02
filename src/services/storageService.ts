import type { AppState, FoodPer100g } from '../types/fitness';

export interface AuthUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

/**
 * Every persistence operation MacroLift needs (profile/workouts/nutrition/weigh-ins -
 * all bundled inside AppState - plus the auth user list and session pointer), behind
 * one interface. Every read/write in the app goes through `storageService` below
 * instead of touching `localStorage` directly, so swapping the backend (e.g. to
 * Supabase) later is a matter of writing one new class that implements this same
 * interface and pointing `storageService` at it - no other file needs to change.
 *
 * The methods are async even though the current implementation is a synchronous
 * localStorage read - that's deliberate, so call sites already look like they're
 * talking to a real network API.
 */
export interface StorageService {
  getAppState(userId: string): Promise<AppState | null>;
  saveAppState(userId: string, state: AppState): Promise<void>;
  deleteAppState(userId: string): Promise<void>;

  getUsers(): Promise<AuthUser[]>;
  saveUsers(users: AuthUser[]): Promise<void>;

  getSessionUserId(): Promise<string | null>;
  setSessionUserId(userId: string): Promise<void>;
  clearSession(): Promise<void>;

  /** Foods looked up through AI, cached on the device so repeat searches never hit the network. */
  getCustomFoods(): Promise<FoodPer100g[]>;
  saveCustomFoods(foods: FoodPer100g[]): Promise<void>;

  /** Video links the user chose for specific exercises, keyed by the exercise's Hebrew name: { name: youtubeId }. */
  getCustomExerciseVideos(): Promise<Record<string, string>>;
  saveCustomExerciseVideos(videos: Record<string, string>): Promise<void>;
}

const APP_STATE_KEY_PREFIX = 'macrolift-app-state-';
const USERS_KEY = 'macrolift-users';
const SESSION_KEY = 'macrolift-session';
const CUSTOM_FOODS_KEY = 'macrolift-custom-foods';
const CUSTOM_EXERCISE_VIDEOS_KEY = 'macrolift-custom-exercise-videos';

function appStateKey(userId: string): string {
  return `${APP_STATE_KEY_PREFIX}${userId}`;
}

class LocalStorageService implements StorageService {
  async getAppState(userId: string): Promise<AppState | null> {
    try {
      const raw = localStorage.getItem(appStateKey(userId));
      return raw ? (JSON.parse(raw) as AppState) : null;
    } catch {
      return null;
    }
  }

  async saveAppState(userId: string, state: AppState): Promise<void> {
    // Lets QuotaExceededError (and any other write failure) propagate to the caller -
    // callers on a path with direct user feedback (e.g. adding a progress photo) can then
    // show a specific message instead of the write silently vanishing.
    localStorage.setItem(appStateKey(userId), JSON.stringify(state));
  }

  async deleteAppState(userId: string): Promise<void> {
    localStorage.removeItem(appStateKey(userId));
  }

  async getUsers(): Promise<AuthUser[]> {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? (JSON.parse(raw) as AuthUser[]) : [];
    } catch {
      return [];
    }
  }

  async saveUsers(users: AuthUser[]): Promise<void> {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  async getSessionUserId(): Promise<string | null> {
    return localStorage.getItem(SESSION_KEY);
  }

  async setSessionUserId(userId: string): Promise<void> {
    localStorage.setItem(SESSION_KEY, userId);
  }

  async clearSession(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
  }

  async getCustomExerciseVideos(): Promise<Record<string, string>> {
    try {
      const raw = localStorage.getItem(CUSTOM_EXERCISE_VIDEOS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  async saveCustomExerciseVideos(videos: Record<string, string>): Promise<void> {
    localStorage.setItem(CUSTOM_EXERCISE_VIDEOS_KEY, JSON.stringify(videos));
  }

  async getCustomFoods(): Promise<FoodPer100g[]> {
    try {
      const raw = localStorage.getItem(CUSTOM_FOODS_KEY);
      return raw ? (JSON.parse(raw) as FoodPer100g[]) : [];
    } catch {
      return [];
    }
  }

  async saveCustomFoods(foods: FoodPer100g[]): Promise<void> {
    localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods));
  }
}

/** The single place the rest of the app imports from - swap the implementation here to change backends. */
export const storageService: StorageService = new LocalStorageService();
