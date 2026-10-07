import type { AppState, FoodEntry, Meal, UserMetrics, UserProfile, WeightLog, WorkoutPlan } from '../types/fitness';
import { getWorkoutTemplate, suggestSplitType } from '../data/workoutTemplates';
import { calculateNutritionPlan } from './calculations';
import { MAX_TDEE_ADJUSTMENT_KCAL } from './calibration';
import { MAX_TARGET_ADJUSTMENT_KCAL } from './targetCheck';
import type { BulkWeightEntry } from './bulkWeightParser';
import { formatIsoDate } from './weightCalculations';

/** What a restore actually loaded - only pieces that were present in the file are counted. */
export interface RestoreSummary {
  weights?: number;
  meals?: number;
  photos?: number;
  workoutDays?: number;
  measurements?: number;
  profileUpdated?: boolean;
}

export type BackupParseResult =
  | { ok: true; kind: 'full'; state: AppState; skippedEntries: number; summary: RestoreSummary }
  | { ok: true; kind: 'weights'; entries: BulkWeightEntry[]; skippedEntries: number; summary: RestoreSummary }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

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

const GOALS = ['lose_weight', 'maintain', 'gain_muscle', 'recomp'];
const BODY_STATES = ['lean', 'athletic', 'higher_fat'];
const GOAL_INTENSITIES = ['moderate', 'aggressive'];
const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

/** Used only when there is no current profile to fall back on (restoring before onboarding). */
const DEFAULT_METRICS: UserMetrics = {
  gender: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  averageDailySteps: 7000,
  trainingDaysPerWeek: 3,
  bodyState: 'athletic',
  goal: 'maintain',
};

/**
 * Merges a backup's metrics onto the current ones field by field (`{ ...current, ...backup }`), but
 * only accepting backup values that are actually usable - a missing or garbled field keeps the
 * current value instead of failing the restore.
 */
function mergeMetrics(current: UserMetrics, raw: unknown): UserMetrics {
  if (!isObject(raw)) return current;
  const merged: UserMetrics = { ...current };
  if (raw.gender === 'male' || raw.gender === 'female') merged.gender = raw.gender;
  for (const key of ['age', 'heightCm', 'weightKg', 'averageDailySteps'] as const) {
    const value = Number(raw[key]);
    if (raw[key] !== null && raw[key] !== '' && Number.isFinite(value) && value > 0) merged[key] = value;
  }
  const days = Number(raw.trainingDaysPerWeek);
  if (Number.isInteger(days) && days >= 2 && days <= 6) merged.trainingDaysPerWeek = days as UserMetrics['trainingDaysPerWeek'];
  if (typeof raw.bodyState === 'string' && BODY_STATES.includes(raw.bodyState)) merged.bodyState = raw.bodyState as UserMetrics['bodyState'];
  if (raw.targetFocus === 'balanced' || raw.targetFocus === 'lower_body' || raw.targetFocus === 'upper_body') merged.targetFocus = raw.targetFocus;
  if (typeof raw.goal === 'string' && GOALS.includes(raw.goal)) merged.goal = raw.goal as UserMetrics['goal'];
  if (typeof raw.goalIntensity === 'string' && GOAL_INTENSITIES.includes(raw.goalIntensity)) {
    merged.goalIntensity = raw.goalIntensity as UserMetrics['goalIntensity'];
  }
  const adjustment = Number(raw.tdeeAdjustmentKcal);
  if (raw.tdeeAdjustmentKcal !== null && raw.tdeeAdjustmentKcal !== '' && Number.isFinite(adjustment) && adjustment !== 0) {
    merged.tdeeAdjustmentKcal = Math.max(-MAX_TDEE_ADJUSTMENT_KCAL, Math.min(MAX_TDEE_ADJUSTMENT_KCAL, Math.round(adjustment)));
  }
  const targetShift = Number(raw.targetAdjustmentKcal);
  if (raw.targetAdjustmentKcal !== null && raw.targetAdjustmentKcal !== '' && Number.isFinite(targetShift) && targetShift !== 0) {
    merged.targetAdjustmentKcal = Math.max(-MAX_TARGET_ADJUSTMENT_KCAL, Math.min(MAX_TARGET_ADJUSTMENT_KCAL, Math.round(targetShift)));
  }
  if (typeof raw.targetAdjustmentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.targetAdjustmentDate)) merged.targetAdjustmentDate = raw.targetAdjustmentDate;
  if (raw.trainingLocation === 'gym' || raw.trainingLocation === 'home') merged.trainingLocation = raw.trainingLocation;
  if (raw.homeEquipment === 'none' || raw.homeEquipment === 'dumbbells') merged.homeEquipment = raw.homeEquipment;
  if (raw.homeLevel === 'beginner' || raw.homeLevel === 'intermediate' || raw.homeLevel === 'advanced') merged.homeLevel = raw.homeLevel;
  if (isObject(raw.measurements)) merged.measurements = raw.measurements as UserMetrics['measurements'];
  if (isObject(raw.experience) && typeof raw.experience.isCurrentlyTraining === 'boolean') {
    merged.experience = raw.experience as unknown as UserMetrics['experience'];
  }
  const plan = raw.bulkingPlan;
  if (isObject(plan) && isFiniteNumber(plan.durationMonths) && typeof plan.startDate === 'string') {
    merged.bulkingPlan = plan as unknown as UserMetrics['bulkingPlan'];
  }
  return merged;
}

/** `{ ...currentProfile, ...backupProfile }` with metrics merged field by field and identity fields type-checked. */
export function mergeProfile(current: UserProfile | undefined, raw: Record<string, unknown>): UserProfile {
  const base: UserProfile = current ?? {
    id: crypto.randomUUID(),
    name: 'משתמש',
    createdAt: new Date().toISOString(),
    metrics: DEFAULT_METRICS,
  };
  return {
    ...base,
    id: typeof raw.id === 'string' && raw.id ? raw.id : base.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : base.name,
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : base.createdAt,
    metrics: mergeMetrics(base.metrics, raw.metrics),
    ...(raw.isGuest === true || base.isGuest === true ? { isGuest: true } : {}),
  };
}

/** Maps one meal-log entry, filling harmless defaults for missing fields; unusable entries (no date or calories) return null. */
function normalizeFoodEntry(raw: unknown): FoodEntry | null {
  if (!isObject(raw)) return null;
  const date = toLocalDateString(raw.date ?? raw.timestamp);
  const calories = Number(raw.calories ?? raw.kcal);
  if (!date || !Number.isFinite(calories) || calories < 0) return null;
  const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    date,
    meal: MEALS.includes(raw.meal as Meal) ? (raw.meal as Meal) : 'snacks',
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'פריט',
    quantity: typeof raw.quantity === 'string' ? raw.quantity : '',
    weightGrams: isFiniteNumber(raw.weightGrams) ? raw.weightGrams : undefined,
    unitLabel: typeof raw.unitLabel === 'string' && raw.unitLabel.trim() ? raw.unitLabel.trim().slice(0, 60) : undefined,
    time: typeof raw.time === 'string' ? raw.time : undefined,
    calories,
    proteinG: num(raw.proteinG ?? raw.protein),
    fatG: num(raw.fatG ?? raw.fat),
    carbsG: num(raw.carbsG ?? raw.carbs),
  };
}

export function hasValidNutritionPlan(plan: unknown): boolean {
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
 * Restoring is deliberately forgiving - one missing or garbled piece must never block the rest:
 * - `version` is informational only (any value, or none, is accepted).
 * - The file's profile is merged onto the user's current profile (`{ ...current, ...backup }`,
 *   field by field), so absent fields (height, age, gender, calories...) just keep their current
 *   values. An unusable nutrition/workout plan falls back to the current one, or is rebuilt.
 * - Weigh-ins (`weighIns` / `weightLogs`, either schema) and meals (`foodLog` / `meals`) are
 *   normalized entry by entry; bad entries are skipped and counted, not fatal.
 * - Anything the file doesn't contain is left exactly as it is on the device.
 * - Only a file with nothing recognizable at all is rejected.
 */
export function parseBackupFile(text: string, current?: AppState): BackupParseResult {
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
  const arrayOf = (...keys: string[]): unknown[] | undefined => {
    for (const key of keys) if (Array.isArray(candidate[key])) return candidate[key] as unknown[];
    return undefined;
  };

  const rawWeights = arrayOf('weightLogs', 'weighIns');
  const rawFood = arrayOf('foodLog', 'meals');
  const rawPhotos = arrayOf('progressPhotos');
  const rawProgress = arrayOf('progress');
  const rawSchedule = arrayOf('schedule');
  const rawSteps = arrayOf('stepLogs');
  const rawCircumference = arrayOf('circumferenceLogs');

  const hasProfile = isObject(candidate.profile);
  const hasOtherData = [rawFood, rawPhotos, rawProgress, rawSchedule, rawSteps, rawCircumference].some((a) => a !== undefined);
  const hasPlans = isObject(candidate.nutritionPlan) || isObject(candidate.workoutPlan);

  if (!hasProfile && !hasOtherData && !hasPlans) {
    return rawWeights ? weightsOnlyResult(rawWeights, invalid) : invalid('קובץ לא תקין - ודא שזהו קובץ גיבוי של MacroLift');
  }

  const profile = mergeProfile(current?.profile, hasProfile ? (candidate.profile as Record<string, unknown>) : {});
  const metrics = profile.metrics;

  const workoutPlan = hasValidWorkoutPlan(candidate.workoutPlan)
    ? candidate.workoutPlan
    : (current?.workoutPlan ?? getWorkoutTemplate(suggestSplitType(metrics.trainingDaysPerWeek), metrics.trainingDaysPerWeek));
  const nutritionPlan = hasValidNutritionPlan(candidate.nutritionPlan)
    ? (candidate.nutritionPlan as AppState['nutritionPlan'])
    : calculateNutritionPlan(metrics);

  let skipped = 0;
  const base: AppState = current ?? {
    profile,
    nutritionPlan,
    workoutPlan,
    progress: [],
    weightLogs: [],
    progressPhotos: [],
    schedule: [],
    foodLog: [],
    stepLogs: [],
    circumferenceLogs: [],
    circumferenceGoals: {},
  };

  const state: AppState = { ...base, profile, nutritionPlan, workoutPlan };

  if (rawWeights) {
    const { logs, skipped: s } = normalizeWeightList(rawWeights);
    state.weightLogs = logs;
    skipped += s;
  }
  if (rawFood) {
    const entries = rawFood.map(normalizeFoodEntry);
    state.foodLog = entries.filter((e): e is FoodEntry => e !== null);
    skipped += entries.length - state.foodLog.length;
  }
  const keepObjects = <T>(raw: unknown[], test: (o: Record<string, unknown>) => boolean): T[] => {
    const kept = raw.filter((o): o is Record<string, unknown> => isObject(o) && test(o));
    skipped += raw.length - kept.length;
    return kept as unknown as T[];
  };
  if (rawPhotos) state.progressPhotos = keepObjects(rawPhotos, (p) => typeof p.date === 'string' && typeof p.photoUrl === 'string');
  if (rawProgress) state.progress = keepObjects(rawProgress, (p) => typeof p.dayId === 'string' && typeof p.exerciseId === 'string' && typeof p.date === 'string');
  if (rawSchedule) state.schedule = keepObjects(rawSchedule, (p) => typeof p.date === 'string' && typeof p.dayId === 'string');
  if (rawSteps) state.stepLogs = keepObjects(rawSteps, (p) => typeof p.date === 'string' && isFiniteNumber(p.steps));
  if (rawCircumference) state.circumferenceLogs = keepObjects(rawCircumference, (p) => typeof p.date === 'string');
  // Favorites and saved meals are cleaned (and bad entries dropped) when the state is next loaded.
  if (Array.isArray(candidate.favoriteFoods)) state.favoriteFoods = candidate.favoriteFoods as AppState['favoriteFoods'];
  if (Array.isArray(candidate.savedMeals)) state.savedMeals = candidate.savedMeals as AppState['savedMeals'];
  if (Array.isArray(candidate.completedWorkoutDates)) {
    state.completedWorkoutDates = candidate.completedWorkoutDates.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  }
  if (isObject(candidate.weeklyBalance) && typeof candidate.weeklyBalance.weekStart === 'string') {
    state.weeklyBalance = candidate.weeklyBalance as unknown as AppState['weeklyBalance'];
  }
  if (isFiniteNumber(candidate.stepGoal) && candidate.stepGoal > 0) state.stepGoal = Math.round(candidate.stepGoal);
  if (candidate.stepGoalMode === 'weekly' || candidate.stepGoalMode === 'daily') state.stepGoalMode = candidate.stepGoalMode;
  if (isObject(candidate.circumferenceGoals)) state.circumferenceGoals = candidate.circumferenceGoals as AppState['circumferenceGoals'];

  const summary: RestoreSummary = {
    profileUpdated: hasProfile,
    weights: rawWeights ? state.weightLogs.length : undefined,
    meals: rawFood ? state.foodLog.length : undefined,
    photos: rawPhotos ? state.progressPhotos.length : undefined,
    workoutDays: rawProgress ? new Set(state.progress.map((p) => p.date)).size : undefined,
    measurements: rawCircumference ? state.circumferenceLogs.length : undefined,
  };

  return { ok: true, kind: 'full', state, skippedEntries: skipped, summary };
}

function weightsOnlyResult(raw: unknown[], invalid: (e: string) => BackupParseResult): BackupParseResult {
  const { logs, skipped } = normalizeWeightList(raw);
  if (logs.length === 0) return invalid('לא נמצאו שקילות תקינות בקובץ');
  return {
    ok: true,
    kind: 'weights',
    entries: logs.map((l) => ({ date: l.date, weightKg: l.weightKg })),
    skippedEntries: skipped,
    summary: { weights: logs.length },
  };
}

/** The human-readable lines describing what a restore loaded, e.g. "נטענו בהצלחה 23 שקילות". */
export function describeRestore(summary: RestoreSummary): string[] {
  const lines: string[] = [];
  if (summary.weights !== undefined) lines.push(`נטענו בהצלחה ${summary.weights} שקילות`);
  if (summary.profileUpdated) lines.push('פרטי הפרופיל עודכנו');
  if (summary.meals) lines.push(`שוחזרו ${summary.meals} רשומות ביומן התזונה`);
  if (summary.workoutDays) lines.push(`שוחזרה היסטוריית אימונים (${summary.workoutDays} ימים)`);
  if (summary.photos) lines.push(`שוחזרו ${summary.photos} תמונות התקדמות`);
  if (summary.measurements) lines.push(`שוחזרו ${summary.measurements} מדידות היקפים`);
  return lines;
}
