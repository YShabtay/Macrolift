import type { BulkingGainRegion, BulkingPlan, CircumferenceEntry, TrainingExperience } from '../types/fitness';
import { forecastGrowthCm, getEarliestValue, getLatestValue, getMonthlyGrowthRateCm, METRIC_LABELS } from './bodyMeasurements';
import { daysBetween, todayIso } from './weightCalculations';

export const BULKING_REGIONS: BulkingGainRegion[] = ['armCm', 'chestCm', 'hipCm'];
export const BULKING_DURATION_OPTIONS = [3, 4, 6, 9, 12];
export const MIN_BULKING_MONTHS = 1;
export const MAX_BULKING_MONTHS = 24;
export const MAX_GAIN_CM = 15;

/** Region labels for the bulk plan - the thigh is stored under hipCm but shown as "ירך" like everywhere else. */
export const REGION_LABELS: Record<BulkingGainRegion, string> = {
  armCm: METRIC_LABELS.armCm,
  chestCm: METRIC_LABELS.chestCm,
  hipCm: METRIC_LABELS.hipCm,
};

const AVG_DAYS_PER_MONTH = 30.4;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The cm-gain target per region, resolving "overall" mode (same number for every region) and dropping unset/zero regions. */
export function getBulkingTargets(plan: BulkingPlan): Partial<Record<BulkingGainRegion, number>> {
  const targets: Partial<Record<BulkingGainRegion, number>> = {};
  for (const region of BULKING_REGIONS) {
    const value = plan.gainMode === 'overall' ? plan.overallGainCm : plan.regionGainCm?.[region];
    if (value !== undefined && value > 0) targets[region] = value;
  }
  return targets;
}

export type PaceVerdict = 'realistic' | 'ambitious' | 'unrealistic';

/**
 * Compares a gain target with what a natural lifter can realistically add over the planned months:
 * anything up to the top of the forecast range is realistic, up to 1.5x of it ambitious, beyond that
 * unlikely to be reached naturally.
 */
export function getGainVerdict(region: BulkingGainRegion, targetCm: number, durationMonths: number, experience: TrainingExperience): PaceVerdict {
  const { maxCm } = forecastGrowthCm(region, experience, durationMonths);
  const ratio = maxCm > 0 ? targetCm / maxCm : Infinity;
  if (ratio <= 1.1) return 'realistic';
  if (ratio <= 1.6) return 'ambitious';
  return 'unrealistic';
}

export interface BulkingRegionForecast {
  region: BulkingGainRegion;
  label: string;
  /** Realistic total growth over the planned months (a range, not the user's target divided by months). */
  minCm: number;
  maxCm: number;
  /** The user's own target for this region, if they set one, and how it compares with the forecast. */
  targetCm?: number;
  verdict?: PaceVerdict;
}

/** Science-based growth forecast for every region over the planned months, with the user's target (if any) judged against it. */
export function forecastBulkingPlan(plan: BulkingPlan, experience: TrainingExperience): BulkingRegionForecast[] {
  const targets = getBulkingTargets(plan);
  return BULKING_REGIONS.map((region) => {
    const { minCm, maxCm } = forecastGrowthCm(region, experience, plan.durationMonths);
    const targetCm = targets[region];
    return {
      region,
      label: REGION_LABELS[region],
      minCm,
      maxCm,
      targetCm,
      verdict: targetCm !== undefined ? getGainVerdict(region, targetCm, plan.durationMonths, experience) : undefined,
    };
  });
}

/** Formats a forecast range: "1.5-2.1" (or a single number when both ends round the same). */
export function formatRangeCm(minCm: number, maxCm: number): string {
  const min = formatCm(minCm);
  const max = formatCm(maxCm);
  return min === max ? min : `${min}-${max}`;
}

export interface BulkingProgress {
  region: BulkingGainRegion;
  label: string;
  gainedCm: number | null; // null until at least two measurements exist
  /** Typical realistic gain by now: the midpoint monthly pace for the user's experience times the months elapsed. */
  expectedCm: number;
}

/** Whole and fractional months elapsed since the plan started, capped at the planned duration. */
export function getElapsedMonths(plan: BulkingPlan, today: string = todayIso()): number {
  const days = Math.max(daysBetween(plan.startDate, today), 0);
  return Math.min(days / AVG_DAYS_PER_MONTH, plan.durationMonths);
}

/**
 * Measured gain so far per region: latest value minus the earliest logged value. Needs two distinct
 * measurements to say anything, so a single log (or none) reports `gainedCm: null`.
 */
export function getBulkingProgress(
  plan: BulkingPlan,
  logs: CircumferenceEntry[],
  experience: TrainingExperience,
  today: string = todayIso(),
): BulkingProgress[] {
  const elapsed = getElapsedMonths(plan, today);
  return BULKING_REGIONS.map((region) => {
    const first = getEarliestValue(logs, region);
    const latest = getLatestValue(logs, region);
    const hasTwoPoints = first !== undefined && latest !== undefined && logs.filter((l) => l[region] !== undefined).length >= 2;
    return {
      region,
      label: REGION_LABELS[region],
      gainedCm: hasTwoPoints ? round2((latest as number) - (first as number)) : null,
      expectedCm: round2(getMonthlyGrowthRateCm(region, experience) * elapsed),
    };
  });
}

/** Formats a cm value without trailing noise: 0.5, 1.25, 3. */
export function formatCm(value: number): string {
  return String(round2(value));
}

// ---------------------------------------------------------------------------
// Editor draft (text inputs) <-> BulkingPlan
// ---------------------------------------------------------------------------

/** Form state for the plan editor: raw text so partially typed numbers don't fight the user. */
export interface BulkingDraft {
  durationText: string;
  gainMode: 'overall' | 'per_region';
  overallText: string;
  regionText: Record<BulkingGainRegion, string>;
}

export function draftFromPlan(plan: BulkingPlan | undefined): BulkingDraft {
  return {
    durationText: plan ? String(plan.durationMonths) : '',
    gainMode: plan?.gainMode ?? 'overall',
    overallText: plan?.overallGainCm !== undefined ? String(plan.overallGainCm) : '',
    regionText: {
      armCm: plan?.regionGainCm?.armCm !== undefined ? String(plan.regionGainCm.armCm) : '',
      chestCm: plan?.regionGainCm?.chestCm !== undefined ? String(plan.regionGainCm.chestCm) : '',
      hipCm: plan?.regionGainCm?.hipCm !== undefined ? String(plan.regionGainCm.hipCm) : '',
    },
  };
}

export type BulkingDraftResult =
  | { status: 'empty' }
  | { status: 'invalid'; error: string }
  | { status: 'ok'; plan: BulkingPlan };

function parseGain(text: string): { empty: true } | { value: number } | { error: string } {
  if (text.trim() === '') return { empty: true };
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_GAIN_CM) return { error: `יעד העלייה חייב להיות בין 0.1 ל-${MAX_GAIN_CM} ס״מ` };
  return { value: Math.round(n * 100) / 100 };
}

/**
 * Turns the editor draft into a plan. No duration means "no plan" (empty). Gain targets are optional,
 * but any that are filled in must be sensible. The start date is preserved when editing an existing
 * plan - changing the targets shouldn't restart the clock on the bulk.
 */
export function parseBulkingDraft(draft: BulkingDraft, existing?: BulkingPlan, today: string = todayIso()): BulkingDraftResult {
  if (draft.durationText.trim() === '') return { status: 'empty' };

  const months = Number(draft.durationText);
  if (!Number.isInteger(months) || months < MIN_BULKING_MONTHS || months > MAX_BULKING_MONTHS) {
    return { status: 'invalid', error: `משך תקופת המסה חייב להיות מספר חודשים שלם בין ${MIN_BULKING_MONTHS} ל-${MAX_BULKING_MONTHS}` };
  }

  const plan: BulkingPlan = { durationMonths: months, startDate: existing?.startDate ?? today, gainMode: draft.gainMode };

  if (draft.gainMode === 'overall') {
    const g = parseGain(draft.overallText);
    if ('error' in g) return { status: 'invalid', error: g.error };
    if ('value' in g) plan.overallGainCm = g.value;
  } else {
    const regionGainCm: Partial<Record<BulkingGainRegion, number>> = {};
    for (const region of BULKING_REGIONS) {
      const g = parseGain(draft.regionText[region]);
      if ('error' in g) return { status: 'invalid', error: g.error };
      if ('value' in g) regionGainCm[region] = g.value;
    }
    if (Object.keys(regionGainCm).length > 0) plan.regionGainCm = regionGainCm;
  }

  return { status: 'ok', plan };
}
