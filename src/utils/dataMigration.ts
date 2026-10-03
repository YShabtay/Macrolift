import type {
  AppState,
  CircumferenceEntry,
  FoodEntry,
  Meal,
  ProgressPhoto,
  SetProgressEntry,
  StepLog,
  WeightLog,
  WorkoutPlan,
  WorkoutScheduleEntry,
} from '../types/fitness';
import { getExerciseAlternatives, getExerciseNameEn, getWorkoutTemplate, suggestSplitType } from '../data/workoutTemplates';
import { calculateNutritionPlan } from './calculations';
import { hasValidNutritionPlan, mergeProfile } from './backupValidation';
import { safeGetJSON } from './safeStorage';

/** Bumped whenever the stored shape changes in a way old data needs repairing for. */
export const SCHEMA_VERSION = 3;

const APP_STATE_KEY_PREFIX = 'macrolift-app-state-';
const CORRUPT_SUFFIX = '-corrupt';
const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isIsoDate = (v: unknown): v is string => typeof v === 'string' && ISO_DATE.test(v);
const finite = (v: unknown): number | null => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
const nonNegative = (v: unknown): number => {
  const n = finite(v);
  return n !== null && n >= 0 ? n : 0;
};
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const idOf = (raw: Record<string, unknown>) => (typeof raw.id === 'string' && raw.id ? raw.id : newId());

/** Keeps the objects that pass `test`, repairing nothing - a bad entry is dropped, the rest of the list survives. */
function keep<T>(raw: unknown, test: (o: Record<string, unknown>) => boolean): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is Record<string, unknown> => isObject(o) && test(o)) as unknown as T[];
}

/** Step history is a list of {date, steps}; an older/hand-edited shape of { "YYYY-MM-DD": steps } is converted. One entry per date, oldest first. */
function normalizeStepLogs(raw: unknown): StepLog[] {
  const pairs: Array<[unknown, unknown]> = [];
  if (Array.isArray(raw)) {
    for (const item of raw) if (isObject(item)) pairs.push([item.date, item.steps]);
  } else if (isObject(raw)) {
    for (const [date, steps] of Object.entries(raw)) pairs.push([date, steps]);
  }
  const byDate = new Map<string, number>();
  for (const [date, steps] of pairs) {
    const n = finite(steps);
    if (isIsoDate(date) && n !== null && n >= 0) byDate.set(date, Math.round(n));
  }
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, steps]) => ({ date, steps }));
}

function normalizeFoodLog(raw: unknown): FoodEntry[] {
  return keep<Record<string, unknown>>(raw, (f) => isIsoDate(f.date)).map((f) => ({
    ...(f as unknown as FoodEntry),
    id: idOf(f),
    meal: MEALS.includes(f.meal as Meal) ? (f.meal as Meal) : 'snacks',
    name: typeof f.name === 'string' && f.name.trim() ? f.name : 'פריט',
    quantity: typeof f.quantity === 'string' ? f.quantity : '',
    calories: nonNegative(f.calories),
    proteinG: nonNegative(f.proteinG),
    fatG: nonNegative(f.fatG),
    carbsG: nonNegative(f.carbsG),
  }));
}

/** Old plans labelled sessions by weekday ("יום א׳"); the sessions are now flexible ("אימון A", "דחיפה (Push)"). */
const LEGACY_WEEKDAY_LABEL = /^יום [א-ו]׳$/;

function normalizeWorkoutPlan(raw: unknown, trainingDays: AppState['profile']['metrics']['trainingDaysPerWeek']): WorkoutPlan {
  if (isObject(raw) && Array.isArray(raw.days)) {
    const templateLabels = new Map<string, string>();
    if (typeof raw.splitType === 'string' && isFiniteNumber(raw.daysPerWeek)) {
      for (const d of getWorkoutTemplate(raw.splitType as WorkoutPlan['splitType'], raw.daysPerWeek as WorkoutPlan['daysPerWeek']).days) {
        templateLabels.set(d.id, d.dayLabel);
      }
    }
    const days = raw.days
      .filter((d): d is Record<string, unknown> => isObject(d) && typeof d.id === 'string')
      .map((day) => ({
        ...day,
        dayLabel:
          typeof day.dayLabel === 'string' && LEGACY_WEEKDAY_LABEL.test(day.dayLabel.trim())
            ? (templateLabels.get(day.id as string) ?? day.dayLabel)
            : day.dayLabel,
        exercises: keep<Record<string, unknown>>(day.exercises, (e) => typeof e.id === 'string' && typeof e.name === 'string').map((exercise) => ({
          ...exercise,
          nameEn: exercise.nameEn ?? getExerciseNameEn(exercise.name as string),
          alternatives: exercise.alternatives ?? getExerciseAlternatives(exercise.name as string),
        })),
      }));
    if (days.length > 0) return { ...raw, days } as unknown as WorkoutPlan;
  }
  return getWorkoutTemplate(suggestSplitType(trainingDays), trainingDays);
}

/**
 * Returns a copy of a stored app state that every component can safely read: all lists exist and contain only usable
 * entries, every numeric field is a number, and missing profile / plan pieces get sensible defaults. History (weigh-ins,
 * workouts, steps, meals, photos) is only ever dropped entry by entry when an entry is unusable on its own.
 * Returns null when the value isn't an object at all. Idempotent: running it on its own output changes nothing.
 */
export function sanitizeAppState(raw: unknown): AppState | null {
  if (!isObject(raw)) return null;

  const profile = mergeProfile(undefined, isObject(raw.profile) ? raw.profile : {});
  const metrics = profile.metrics;

  const state: AppState = {
    ...(raw as unknown as AppState),
    profile,
    nutritionPlan: hasValidNutritionPlan(raw.nutritionPlan) ? (raw.nutritionPlan as AppState['nutritionPlan']) : calculateNutritionPlan(metrics),
    workoutPlan: normalizeWorkoutPlan(raw.workoutPlan, metrics.trainingDaysPerWeek),
    progress: keep<SetProgressEntry>(raw.progress, (p) => typeof p.dayId === 'string' && typeof p.exerciseId === 'string' && isIsoDate(p.date)),
    weightLogs: keep<Record<string, unknown>>(raw.weightLogs, (w) => isIsoDate(w.date) && (finite(w.weightKg) ?? 0) > 0).map((w) => ({
      ...(w as unknown as WeightLog),
      id: idOf(w),
      weightKg: Number(w.weightKg),
    })),
    progressPhotos: keep<Record<string, unknown>>(raw.progressPhotos, (p) => isIsoDate(p.date) && typeof p.photoUrl === 'string' && p.photoUrl.length > 0).map(
      (p) => ({ ...(p as unknown as ProgressPhoto), id: idOf(p) }),
    ),
    schedule: keep<WorkoutScheduleEntry>(raw.schedule, (s) => isIsoDate(s.date) && typeof s.dayId === 'string'),
    foodLog: normalizeFoodLog(raw.foodLog),
    stepLogs: normalizeStepLogs(raw.stepLogs),
    circumferenceLogs: keep<Record<string, unknown>>(raw.circumferenceLogs, (c) => isIsoDate(c.date)).map((c) => ({
      ...(c as unknown as CircumferenceEntry),
      id: idOf(c),
    })),
    circumferenceGoals: isObject(raw.circumferenceGoals) ? (raw.circumferenceGoals as AppState['circumferenceGoals']) : {},
  };

  // Optional fields: kept only when usable, otherwise removed so the app's own defaults apply.
  const stepGoal = finite(raw.stepGoal);
  if (stepGoal !== null && stepGoal > 0) state.stepGoal = Math.round(stepGoal);
  else delete state.stepGoal;

  if (Array.isArray(raw.completedWorkoutDates)) state.completedWorkoutDates = raw.completedWorkoutDates.filter(isIsoDate);
  else delete state.completedWorkoutDates;

  if (!(isObject(raw.weeklyBalance) && isIsoDate(raw.weeklyBalance.weekStart))) delete state.weeklyBalance;

  (state as AppState & { schemaVersion?: number }).schemaVersion = SCHEMA_VERSION;
  return state;
}

export interface MigrationReport {
  checked: number;
  rewritten: number;
  unreadable: number;
}

/**
 * Runs once at startup, before React renders: repairs every user's saved app state in place so the current code never
 * meets a shape it doesn't expect. Rewrites only what actually changed, never touches a state it can't parse (a copy of the
 * raw text is set aside instead), and never throws - a failure here must not stop the app from starting.
 */
export function sanitizeAndMigrateStorage(): MigrationReport {
  const report: MigrationReport = { checked: 0, rewritten: 0, unreadable: 0 };
  try {
    if (typeof localStorage === 'undefined') return report;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(APP_STATE_KEY_PREFIX) && !key.endsWith(CORRUPT_SUFFIX)) keys.push(key);
    }

    for (const key of keys) {
      report.checked += 1;
      try {
        const raw = localStorage.getItem(key);
        const parsed = safeGetJSON<unknown>(key, null);
        const sanitized = parsed === null ? null : sanitizeAppState(parsed);
        if (!sanitized) {
          report.unreadable += 1;
          // Keep the original text so it can still be recovered by hand; the app then treats the user as new instead of crashing.
          if (raw && localStorage.getItem(key + CORRUPT_SUFFIX) === null) {
            try {
              localStorage.setItem(key + CORRUPT_SUFFIX, raw);
            } catch {
              // No room for a copy: leave the original in place.
            }
          }
          continue;
        }
        const next = JSON.stringify(sanitized);
        if (next !== raw) {
          localStorage.setItem(key, next);
          report.rewritten += 1;
        }
      } catch {
        // One user's data failing (e.g. storage full on write) must not block the others - the original stays untouched.
      }
    }
  } catch {
    // Storage unavailable entirely.
  }
  return report;
}
