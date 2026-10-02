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

export interface GrowthRange {
  minCmPerMonth: number;
  maxCmPerMonth: number;
}

/**
 * Realistic monthly circumference growth (cm) for a natural lifter in a clean bulk: arm 0.25-0.35,
 * chest/back 0.5-0.6, thigh 0.5-0.7. These ranges apply to beginners and intermediates; advanced
 * lifters (3+ years) are closer to their genetic ceiling and grow at roughly half that pace.
 */
const BASE_GROWTH_RANGE_CM_PER_MONTH: Record<GrowthMetric, GrowthRange> = {
  armCm: { minCmPerMonth: 0.25, maxCmPerMonth: 0.35 },
  chestCm: { minCmPerMonth: 0.5, maxCmPerMonth: 0.6 },
  hipCm: { minCmPerMonth: 0.5, maxCmPerMonth: 0.7 },
};

const EXPERIENCE_GROWTH_FACTOR: Record<TrainingExperience, number> = { under_1y: 1, '1_3y': 1, over_3y: 0.5 };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getGrowthRangeCm(metric: GrowthMetric, experience: TrainingExperience): GrowthRange {
  const base = BASE_GROWTH_RANGE_CM_PER_MONTH[metric];
  const factor = EXPERIENCE_GROWTH_FACTOR[experience];
  return { minCmPerMonth: round2(base.minCmPerMonth * factor), maxCmPerMonth: round2(base.maxCmPerMonth * factor) };
}

/** Expected total growth (cm) over a number of months of bulking, as a realistic min-max range. */
export function forecastGrowthCm(metric: GrowthMetric, experience: TrainingExperience, months: number): { minCm: number; maxCm: number } {
  const range = getGrowthRangeCm(metric, experience);
  return { minCm: round2(range.minCmPerMonth * months), maxCm: round2(range.maxCmPerMonth * months) };
}

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

/** Midpoint of the realistic monthly range - the single "typical" pace used for time-to-goal estimates. */
export function getMonthlyGrowthRateCm(metric: GrowthMetric, experience: TrainingExperience): number {
  const { minCmPerMonth, maxCmPerMonth } = getGrowthRangeCm(metric, experience);
  return round2((minCmPerMonth + maxCmPerMonth) / 2);
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
export function getWaistCeilingCm(logs: CircumferenceEntry[]): number | null {
  const startingWaist = getEarliestValue(logs, 'waistCm');
  return startingWaist === undefined ? null : Math.round((startingWaist + 2) * 10) / 10;
}

export function getWaistCeilingWarning(logs: CircumferenceEntry[], goal: Goal): string | null {
  if (goal !== 'gain_muscle') return null;
  const ceiling = getWaistCeilingCm(logs);
  return ceiling === null ? null : `שמור על היקף מותניים מתחת ל-${ceiling} ס״מ כדי להבטיח עלייה נקייה בשריר`;
}
