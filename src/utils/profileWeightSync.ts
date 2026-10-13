import type { UserMetrics, WeightLog } from '../types/fitness';
import { buildWeeklySummaries, getWeekStart } from './weightCalculations';

/**
 * The calorie target, protein and the calories from steps are all computed from the weight in the profile. When the weigh-ins settle somewhere else
 * (a bulk of a few kilos, or a cut), the targets slowly drift from the person. This keeps the profile weight in line with the weekly average.
 * It only ever looks at the average of a completed week, never at a single weigh-in (water and meals move the scale by a kilo from day to day),
 * and only moves when that average is a real distance away from the profile, so the target does not shift every week.
 */

/** The last completed week's average has to differ from the profile weight by at least this much (kg). */
const MIN_DIFF_KG = 1;
/** A week needs this many weigh-ins to count. */
const MIN_WEEK_LOGS = 2;
const MIN_PLAUSIBLE_KG = 30;
const MAX_PLAUSIBLE_KG = 300;

export interface WeightSyncSuggestion {
  /** The average of the latest completed week, rounded to 0.1 kg. */
  suggestedKg: number;
  profileKg: number;
  diffKg: number;
}

/** The Sunday that starts the latest completed week with enough weigh-ins to have an average, or null when there is none yet. */
export function getLatestSyncWeekStart(weightLogs: WeightLog[], today: string): string | null {
  const thisWeek = getWeekStart(today);
  const weeks = buildWeeklySummaries(weightLogs).filter((w) => w.weekStart < thisWeek && w.daysLogged >= MIN_WEEK_LOGS);
  return weeks.length > 0 ? weeks[weeks.length - 1].weekStart : null;
}

/**
 * A new profile weight when the latest completed week's average (at least two weigh-ins; the week in progress is not counted) is 1 kg or more away
 * from the profile weight. After the update the profile sits on that average, so nothing more is suggested until the average moves a kilo again.
 */
export function getWeightSyncSuggestion(params: { metrics: UserMetrics; weightLogs: WeightLog[]; today: string }): WeightSyncSuggestion | null {
  const { metrics, weightLogs, today } = params;
  const thisWeek = getWeekStart(today);
  const weeks = buildWeeklySummaries(weightLogs).filter((w) => w.weekStart < thisWeek && w.daysLogged >= MIN_WEEK_LOGS);
  const latest = weeks[weeks.length - 1];
  if (!latest) return null;
  const suggestedKg = Math.round(latest.averageKg * 10) / 10;
  if (suggestedKg < MIN_PLAUSIBLE_KG || suggestedKg > MAX_PLAUSIBLE_KG) return null;
  const diffKg = Math.round((suggestedKg - metrics.weightKg) * 10) / 10;
  if (Math.abs(diffKg) < MIN_DIFF_KG) return null;
  return { suggestedKg, profileKg: metrics.weightKg, diffKg };
}
