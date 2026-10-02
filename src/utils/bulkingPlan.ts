import type { BulkingGainRegion, BulkingPlan, CircumferenceEntry, TrainingExperience } from '../types/fitness';
import { getEarliestValue, getLatestValue, getMonthlyGrowthRateCm, METRIC_LABELS } from './bodyMeasurements';
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

/** Expected growth per month for a total gain over a duration, e.g. 3 cm over 6 months = 0.5 cm/month. */
export function monthlyRateCm(totalGainCm: number, durationMonths: number): number {
  return durationMonths > 0 ? round2(totalGainCm / durationMonths) : 0;
}

export type PaceVerdict = 'realistic' | 'ambitious' | 'unrealistic';

/**
 * Compares the planned monthly pace with the natural growth rate for the user's training experience
 * (the same benchmark the circumference tracker uses): up to 1.5x it is realistic, up to 3x
 * ambitious, beyond that unlikely to be reached naturally.
 */
export function getPaceVerdict(region: BulkingGainRegion, perMonthCm: number, experience: TrainingExperience): PaceVerdict {
  const benchmark = getMonthlyGrowthRateCm(region, experience);
  const ratio = benchmark > 0 ? perMonthCm / benchmark : Infinity;
  if (ratio <= 1.5) return 'realistic';
  if (ratio <= 3) return 'ambitious';
  return 'unrealistic';
}

export interface BulkingRegionPlan {
  region: BulkingGainRegion;
  label: string;
  totalGainCm: number;
  perMonthCm: number;
  verdict: PaceVerdict;
}

/** Per-region view of a plan: total target, expected monthly pace and how realistic that pace is. */
export function describeBulkingPlan(plan: BulkingPlan, experience: TrainingExperience): BulkingRegionPlan[] {
  const targets = getBulkingTargets(plan);
  return BULKING_REGIONS.filter((r) => targets[r] !== undefined).map((region) => {
    const totalGainCm = targets[region] as number;
    const perMonthCm = monthlyRateCm(totalGainCm, plan.durationMonths);
    return { region, label: REGION_LABELS[region], totalGainCm, perMonthCm, verdict: getPaceVerdict(region, perMonthCm, experience) };
  });
}

export interface BulkingProgress {
  region: BulkingGainRegion;
  label: string;
  gainedCm: number | null; // null until at least two measurements exist
  targetCm: number;
  /** Where the user "should" be by now if growing linearly across the planned months. */
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
export function getBulkingProgress(plan: BulkingPlan, logs: CircumferenceEntry[], today: string = todayIso()): BulkingProgress[] {
  const targets = getBulkingTargets(plan);
  const elapsed = getElapsedMonths(plan, today);
  return BULKING_REGIONS.filter((r) => targets[r] !== undefined).map((region) => {
    const targetCm = targets[region] as number;
    const first = getEarliestValue(logs, region);
    const latest = getLatestValue(logs, region);
    const hasTwoPoints = first !== undefined && latest !== undefined && logs.filter((l) => l[region] !== undefined).length >= 2;
    return {
      region,
      label: REGION_LABELS[region],
      gainedCm: hasTwoPoints ? round2((latest as number) - (first as number)) : null,
      targetCm,
      expectedCm: round2(monthlyRateCm(targetCm, plan.durationMonths) * elapsed),
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
