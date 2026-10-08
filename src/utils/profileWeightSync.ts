import type { UserMetrics, WeightLog } from '../types/fitness';
import { buildWeeklySummaries, getWeekStart } from './weightCalculations';

/**
 * The calorie target, protein and the calories from steps are all computed from the weight in the profile, which is only the weight typed in the
 * profile. When the weigh-ins settle somewhere else (a bulk of a few kilos), the targets slowly drift from the person. This notices that and offers to
 * update the profile weight. It never changes it silently: an automatic update every week would move the target every week.
 */

/** The weekly average has to differ from the profile by this much (kg) or this share of it, whichever is smaller. */
const MIN_DIFF_KG = 2;
const MIN_DIFF_SHARE = 0.03;
/** A week needs this many weigh-ins to count. */
const MIN_WEEK_LOGS = 2;
const SNOOZE_DAYS = 14;

export interface WeightSyncSuggestion {
  /** The average of the latest completed week, rounded to 0.1 kg. */
  suggestedKg: number;
  profileKg: number;
  diffKg: number;
}

/**
 * A suggestion when the last two weekly averages (weeks with at least two weigh-ins, the week in progress not counted) both sit at least ~2 kg
 * (or 3%) away from the profile weight, on the same side. One odd week is noise; two in a row is a real change.
 */
export function getWeightSyncSuggestion(params: { metrics: UserMetrics; weightLogs: WeightLog[]; today: string }): WeightSyncSuggestion | null {
  const { metrics, weightLogs, today } = params;
  const thisWeek = getWeekStart(today);
  const weeks = buildWeeklySummaries(weightLogs).filter((w) => w.weekStart < thisWeek && w.daysLogged >= MIN_WEEK_LOGS);
  if (weeks.length < 2) return null;
  const [previous, latest] = weeks.slice(-2);
  const threshold = Math.min(MIN_DIFF_KG, metrics.weightKg * MIN_DIFF_SHARE);
  const diffs = [previous, latest].map((w) => w.averageKg - metrics.weightKg);
  const sameSide = diffs.every((d) => d >= threshold) || diffs.every((d) => d <= -threshold);
  if (!sameSide) return null;
  const suggestedKg = Math.round(latest.averageKg * 10) / 10;
  return { suggestedKg, profileKg: metrics.weightKg, diffKg: Math.round((suggestedKg - metrics.weightKg) * 10) / 10 };
}

export { SNOOZE_DAYS as WEIGHT_SYNC_SNOOZE_DAYS };
