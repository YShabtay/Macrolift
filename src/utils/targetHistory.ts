import type { AppState, NutritionPlan, TargetHistoryEntry } from '../types/fitness';

/** The date of the first entry: the target the plan had before anything was recorded. */
export const HISTORY_BEGINNING = '1970-01-01';
const MAX_ENTRIES = 60;

/**
 * The calorie target a day had. Every day's target is computed from the plan the person has now, so when the target changes (an accepted correction, a new
 * weight, a calibration) the days that are over would be judged by it too: a +100 on Friday made every earlier day of the week 100 kcal "less over". The plan
 * keeps the dates its target changed on, and a day is judged by the target it had.
 */
export function getTargetOnDate(plan: Pick<NutritionPlan, 'targetCalories' | 'targetHistory'>, date: string): number {
  const history = plan.targetHistory;
  if (!history || history.length === 0) return plan.targetCalories;
  let kcal = history[0].calories;
  for (const entry of history) {
    if (entry.from <= date) kcal = entry.calories;
    else break;
  }
  return kcal;
}

/** What the target was before a change that was accepted on a known date, when no history exists yet (an account from before it was kept). */
function seedHistory(state: AppState): TargetHistoryEntry[] {
  const target = state.nutritionPlan.targetCalories;
  const { targetAdjustmentKcal, targetAdjustmentDate } = state.profile.metrics;
  if (targetAdjustmentKcal && targetAdjustmentDate) {
    return [
      { from: HISTORY_BEGINNING, calories: target - targetAdjustmentKcal },
      { from: targetAdjustmentDate, calories: target },
    ];
  }
  return [{ from: HISTORY_BEGINNING, calories: target }];
}

/** Records today's date when the plan's target is not the one the history ends with. Returns the same object when nothing changed. */
export function trackTargetHistory(state: AppState, today: string): AppState {
  const target = state.nutritionPlan.targetCalories;
  const history = state.targetHistory ?? seedHistory(state);
  const last = history[history.length - 1];
  if (last.calories === target) return state.targetHistory ? state : { ...state, targetHistory: history };
  const kept = last.from === today ? history.slice(0, -1) : history;
  return { ...state, targetHistory: [...kept, { from: today, calories: target }].slice(-MAX_ENTRIES) };
}

/** The state with the history on its plan, for the screens (the stored plan stays as it is, so recalculating the plan never loses the history). */
export function attachTargetHistory(state: AppState): AppState {
  const history = state.targetHistory;
  if (!history || history.length < 2) return state;
  return { ...state, nutritionPlan: { ...state.nutritionPlan, targetHistory: history } };
}

/** Keeps only well-formed entries, in date order. */
export function sanitizeTargetHistory(raw: unknown): TargetHistoryEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const entries = raw
    .filter((e): e is TargetHistoryEntry => !!e && typeof e === 'object' && typeof (e as TargetHistoryEntry).from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((e as TargetHistoryEntry).from) && Number.isFinite((e as TargetHistoryEntry).calories) && (e as TargetHistoryEntry).calories > 0)
    .map((e) => ({ from: e.from, calories: Math.round(e.calories) }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
    .slice(-MAX_ENTRIES);
  return entries.length > 0 ? entries : null;
}
