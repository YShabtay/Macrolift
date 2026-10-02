import type { AppState, UserMetrics, WeightLog, WorkoutPlan } from '../types/fitness';
import { getWorkoutTemplate, suggestSplitType } from '../data/workoutTemplates';
import { calculateNutritionPlan } from './calculations';
import type { BulkWeightEntry } from './bulkWeightParser';
import { formatIsoDate } from './weightCalculations';

export type BackupParseResult =
  | { ok: true; kind: 'full'; state: AppState; skippedEntries: number }
  | { ok: true; kind: 'weights'; entries: BulkWeightEntry[]; skippedEntries: number }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const OPTIONAL_LOG_ARRAYS = ['progress', 'weightLogs', 'progressPhotos', 'schedule', 'foodLog', 'stepLogs', 'circumferenceLogs'] as const;

/**
 * Reads a weigh-in date from the formats real backup files use: YYYY-MM-DD, DD/MM/YYYY, any
 * Date-parsable string (ISO timestamps), or a numeric epoch (ms, or seconds). Always returned as a
 * local YYYY-MM-DD, matching the rest of the app's date handling.
 */
function toLocalDateString(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : formatIsoDate(new Date(parsed));
  }
  if (isFiniteNumber(value)) return formatIsoDate(new Date(value < 1e11 ? value * 1000 : value));
  return null;
}

/**
 * Maps one weigh-in from either schema into the app's WeightLog: `weightKg` or `weight`, `date` or
 * `timestamp`, and a generated id when the file doesn't have one. Returns null for unusable entries.
 */
function normalizeWeightEntry(raw: unknown): WeightLog | null {
  if (!isObject(raw)) return null;
  const weight = Number(raw.weightKg ?? raw.weight);
  const date = toLocalDateString(raw.date ?? raw.timestamp);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500 || !date) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    date,
    weightKg: weight,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
  };
}

/** Normalizes a list of raw weigh-ins: one entry per date (later wins), oldest first. Counts what was dropped. */
function normalizeWeightList(raw: unknown[]): { logs: WeightLog[]; skipped: number } {
  const byDate = new Map<string, WeightLog>();
  let skipped = 0;
  for (const item of raw) {
    const entry = normalizeWeightEntry(item);
    if (entry) byDate.set(entry.date, entry);
    else skipped += 1;
  }
  const logs = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { logs, skipped };
}

function hasValidMetrics(metrics: unknown): metrics is UserMetrics {
  return (
    isObject(metrics) &&
    (metrics.gender === 'male' || metrics.gender === 'female') &&
    isFiniteNumber(metrics.age) &&
    isFiniteNumber(metrics.heightCm) &&
    isFiniteNumber(metrics.weightKg) &&
    isFiniteNumber(metrics.averageDailySteps) &&
    isFiniteNumber(metrics.trainingDaysPerWeek) &&
    typeof metrics.goal === 'string'
  );
}

function hasValidNutritionPlan(plan: unknown): boolean {
  return (
    isObject(plan) &&
    isFiniteNumber(plan.bmr) &&
    isFiniteNumber(plan.tdee) &&
    isFiniteNumber(plan.targetCalories) &&
    isObject(plan.macros)
  );
}

function hasValidWorkoutPlan(plan: unknown): plan is WorkoutPlan {
  if (!isObject(plan) || !Array.isArray(plan.days) || plan.days.length === 0) return false;
  return plan.days.every(
    (day) =>
      isObject(day) &&
      typeof day.id === 'string' &&
      Array.isArray(day.exercises) &&
      day.exercises.every((ex) => isObject(ex) && typeof ex.id === 'string' && typeof ex.name === 'string' && isFiniteNumber(ex.sets)),
  );
}

/**
 * Validates and normalizes a backup file before it is allowed to touch local data.
 *
 * - The `version` field is informational only and never blocks a restore: numbers, "1", "1.0",
 *   "1.0.0", other versions, or no version at all are all accepted - what matters is that the data
 *   itself has a usable structure.
 * - A full backup needs a valid profile; a missing/invalid nutrition or workout plan is rebuilt from
 *   the profile's metrics instead of rejecting the file.
 * - A file that only holds weigh-ins (`weighIns` / `weightLogs` array, or a bare array) is restored
 *   as a weight-history merge.
 * - Weigh-ins in either schema (`weightKg`|`weight`, `date`|`timestamp`) are mapped into WeightLog.
 */
export function parseBackupFile(text: string): BackupParseResult {
  const invalid = (error: string): BackupParseResult => ({ ok: false, error });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalid('הקובץ אינו JSON תקין - ייתכן שהוא פגום או לא הושלם');
  }

  // A bare array is treated as a list of weigh-ins.
  if (Array.isArray(parsed)) return weightsOnlyResult(parsed, invalid);
  if (!isObject(parsed)) return invalid('מבנה הקובץ אינו תקין');

  const candidate = isObject(parsed.appState) ? parsed.appState : parsed;
  const rawWeights = Array.isArray(candidate.weightLogs)
    ? candidate.weightLogs
    : Array.isArray(candidate.weighIns)
      ? candidate.weighIns
      : undefined;

  if (!isObject(candidate.profile)) {
    return rawWeights ? weightsOnlyResult(rawWeights, invalid) : invalid('קובץ לא תקין - ודא שזהו קובץ גיבוי של MacroLift');
  }

  const profile = candidate.profile;
  if (!hasValidMetrics(profile.metrics)) return invalid('פרטי הפרופיל בגיבוי חסרים או שגויים');
  const metrics = profile.metrics;

  const workoutPlan = hasValidWorkoutPlan(candidate.workoutPlan)
    ? candidate.workoutPlan
    : getWorkoutTemplate(suggestSplitType(metrics.trainingDaysPerWeek), metrics.trainingDaysPerWeek);
  const nutritionPlan = hasValidNutritionPlan(candidate.nutritionPlan) ? candidate.nutritionPlan : calculateNutritionPlan(metrics);

  for (const key of OPTIONAL_LOG_ARRAYS) {
    const value = candidate[key];
    if (value !== undefined && !Array.isArray(value)) return invalid(`הנתונים בגיבוי (${key}) פגומים`);
  }
  const foodLog = (candidate.foodLog ?? []) as unknown[];
  if (!foodLog.every((f) => isObject(f) && typeof f.date === 'string' && isFiniteNumber(f.calories) && isFiniteNumber(f.proteinG))) {
    return invalid('יומן התזונה בגיבוי פגום');
  }
  const photos = (candidate.progressPhotos ?? []) as unknown[];
  if (!photos.every((p) => isObject(p) && typeof p.date === 'string' && typeof p.photoUrl === 'string')) {
    return invalid('תמונות ההתקדמות בגיבוי פגומות');
  }

  const { logs, skipped } = normalizeWeightList(rawWeights ?? []);

  const state = {
    ...candidate,
    profile,
    workoutPlan,
    nutritionPlan,
    weightLogs: logs,
  } as unknown as AppState;
  // weighIns was only an input alias - don't carry the duplicate field into stored state.
  delete (state as unknown as Record<string, unknown>).weighIns;

  return { ok: true, kind: 'full', state, skippedEntries: skipped };
}

function weightsOnlyResult(raw: unknown[], invalid: (e: string) => BackupParseResult): BackupParseResult {
  const { logs, skipped } = normalizeWeightList(raw);
  if (logs.length === 0) return invalid('לא נמצאו שקילות תקינות בקובץ');
  return { ok: true, kind: 'weights', entries: logs.map((l) => ({ date: l.date, weightKg: l.weightKg })), skippedEntries: skipped };
}
