import type { AppState } from '../types/fitness';

export type BackupParseResult = { ok: true; state: AppState } | { ok: false; error: string };

const SUPPORTED_BACKUP_VERSION = 1;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const OPTIONAL_LOG_ARRAYS = [
  'progress',
  'weightLogs',
  'progressPhotos',
  'schedule',
  'foodLog',
  'stepLogs',
  'circumferenceLogs',
] as const;

/**
 * Validates a backup file's contents before it is allowed to overwrite local data. Checks the
 * structure every screen relies on (profile metrics, nutrition plan, workout plan days and
 * exercises, log arrays) so a truncated, hand-edited or wrong file is rejected up front instead
 * of crashing the app after the existing data has already been replaced.
 */
export function parseBackupFile(text: string): BackupParseResult {
  const invalid = (error: string): BackupParseResult => ({ ok: false, error });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalid('הקובץ אינו JSON תקין - ייתכן שהוא פגום או לא הושלם');
  }
  if (!isObject(parsed)) return invalid('מבנה הקובץ אינו תקין');

  if (parsed.version !== undefined) {
    if (!isFiniteNumber(parsed.version)) return invalid('גרסת הגיבוי אינה תקינה');
    if (parsed.version > SUPPORTED_BACKUP_VERSION) {
      return invalid('הגיבוי נוצר בגרסה חדשה יותר של האפליקציה - עדכנו את האפליקציה ונסו שוב');
    }
  }

  const candidate = isObject(parsed.appState) ? parsed.appState : parsed;

  const { profile, nutritionPlan, workoutPlan } = candidate;
  if (!isObject(profile) || !isObject(nutritionPlan) || !isObject(workoutPlan)) {
    return invalid('קובץ לא תקין - ודא שזהו קובץ גיבוי של MacroLift');
  }

  const metrics = profile.metrics;
  if (
    !isObject(metrics) ||
    (metrics.gender !== 'male' && metrics.gender !== 'female') ||
    !isFiniteNumber(metrics.age) ||
    !isFiniteNumber(metrics.heightCm) ||
    !isFiniteNumber(metrics.weightKg) ||
    !isFiniteNumber(metrics.averageDailySteps) ||
    !isFiniteNumber(metrics.trainingDaysPerWeek) ||
    typeof metrics.goal !== 'string'
  ) {
    return invalid('פרטי הפרופיל בגיבוי חסרים או שגויים');
  }

  if (
    !isFiniteNumber(nutritionPlan.bmr) ||
    !isFiniteNumber(nutritionPlan.tdee) ||
    !isFiniteNumber(nutritionPlan.targetCalories) ||
    !isObject(nutritionPlan.macros)
  ) {
    return invalid('תוכנית התזונה בגיבוי חסרה או שגויה');
  }

  const days = workoutPlan.days;
  if (!Array.isArray(days) || days.length === 0) return invalid('תוכנית האימונים בגיבוי חסרה או ריקה');
  for (const day of days) {
    if (!isObject(day) || typeof day.id !== 'string' || !Array.isArray(day.exercises)) {
      return invalid('תוכנית האימונים בגיבוי פגומה');
    }
    for (const exercise of day.exercises) {
      if (!isObject(exercise) || typeof exercise.id !== 'string' || typeof exercise.name !== 'string' || !isFiniteNumber(exercise.sets)) {
        return invalid('תוכנית האימונים בגיבוי פגומה');
      }
    }
  }

  for (const key of OPTIONAL_LOG_ARRAYS) {
    const value = candidate[key];
    if (value !== undefined && !Array.isArray(value)) return invalid(`הנתונים בגיבוי (${key}) פגומים`);
  }

  const weightLogs = (candidate.weightLogs ?? []) as unknown[];
  if (!weightLogs.every((l) => isObject(l) && typeof l.date === 'string' && isFiniteNumber(l.weightKg))) {
    return invalid('היסטוריית השקילות בגיבוי פגומה');
  }
  const foodLog = (candidate.foodLog ?? []) as unknown[];
  if (!foodLog.every((f) => isObject(f) && typeof f.date === 'string' && isFiniteNumber(f.calories) && isFiniteNumber(f.proteinG))) {
    return invalid('יומן התזונה בגיבוי פגום');
  }
  const photos = (candidate.progressPhotos ?? []) as unknown[];
  if (!photos.every((p) => isObject(p) && typeof p.date === 'string' && typeof p.photoUrl === 'string')) {
    return invalid('תמונות ההתקדמות בגיבוי פגומות');
  }

  return { ok: true, state: candidate as unknown as AppState };
}
