import type { CircumferenceEntry, Goal, TrainingExperience } from '../types/fitness';

/** The 3 metrics with a data-backed monthly growth rate. Waist is tracked separately (fat control, not a growth target). */
export type GrowthMetric = 'armCm' | 'chestCm' | 'hipCm';

export type CircumferenceMetricKey = GrowthMetric | 'waistCm';

export const METRIC_LABELS: Record<CircumferenceMetricKey, string> = {
  armCm: 'זרוע',
  chestCm: 'חזה',
  waistCm: 'מותניים',
  hipCm: 'ירך',
};

export const EXPERIENCE_LABELS: Record<TrainingExperience, string> = {
  under_1y: 'מתחיל (פחות משנה)',
  '1_3y': 'בינוני (1-3 שנים)',
  over_3y: 'מתקדם (3+ שנים)',
};

/** Estimated monthly circumference growth (cm), by training experience. */
const GROWTH_RATE_CM_PER_MONTH: Record<GrowthMetric, Record<TrainingExperience, number>> = {
  armCm: { under_1y: 0.35, '1_3y': 0.18, over_3y: 0.08 },
  chestCm: { under_1y: 0.8, '1_3y': 0.4, over_3y: 0.2 },
  hipCm: { under_1y: 0.5, '1_3y': 0.25, over_3y: 0.15 },
};

/** Roughly the outer edge of natural lifetime circumference gain from any starting point, regardless of timeframe. */
const NATURAL_MAX_GAIN_CM: Record<GrowthMetric, number> = {
  armCm: 6,
  chestCm: 12,
  hipCm: 10,
};

/** Falls back to "under_1y" (the fastest-progress tier) when the user never filled in the experience questionnaire. */
export function getEffectiveExperience(experienceYears: TrainingExperience | undefined): TrainingExperience {
  return experienceYears ?? 'under_1y';
}

export function getMonthlyGrowthRateCm(metric: GrowthMetric, experience: TrainingExperience): number {
  return GROWTH_RATE_CM_PER_MONTH[metric][experience];
}

/** Months to reach the goal at the given pace; null when the goal is already met (or below current) or the rate is zero. */
export function estimateMonthsToGoal(currentCm: number, goalCm: number, monthlyRateCm: number): number | null {
  const delta = goalCm - currentCm;
  if (delta <= 0 || monthlyRateCm <= 0) return null;
  return Math.ceil(delta / monthlyRateCm);
}

/** Whether a growth goal sits within a naturally achievable range, independent of how long the user is willing to wait. */
export function isRealisticGoal(metric: GrowthMetric, currentCm: number, goalCm: number): boolean {
  return goalCm - currentCm <= NATURAL_MAX_GAIN_CM[metric];
}

/** Most recent logged value for a metric, skipping entries where it wasn't filled in. */
export function getLatestValue(logs: CircumferenceEntry[], metric: CircumferenceMetricKey): number | undefined {
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const entry of sorted) {
    if (entry[metric] !== undefined) return entry[metric];
  }
  return undefined;
}

/** Earliest logged value for a metric, skipping entries where it wasn't filled in. */
export function getEarliestValue(logs: CircumferenceEntry[], metric: CircumferenceMetricKey): number | undefined {
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const entry of sorted) {
    if (entry[metric] !== undefined) return entry[metric];
  }
  return undefined;
}

/**
 * Smart fat-control hint shown only while lean-bulking: keep the waist within a small
 * buffer of where it started, so the surplus is going mostly toward muscle, not fat.
 */
export function getWaistCeilingWarning(logs: CircumferenceEntry[], goal: Goal): string | null {
  if (goal !== 'gain_muscle') return null;
  const startingWaist = getEarliestValue(logs, 'waistCm');
  if (startingWaist === undefined) return null;
  const ceiling = Math.round((startingWaist + 2) * 10) / 10;
  return `שמור על היקף מותניים מתחת ל-${ceiling} ס״מ כדי להבטיח עלייה נקייה בשריר`;
}
