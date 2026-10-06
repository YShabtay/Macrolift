import type { AppState, FoodEntry, WeightLog } from '../types/fitness';
import { calculateNutritionPlan } from './calculations';

/**
 * Personal calibration of the daily energy expenditure (TDEE).
 *
 * A formula gives the average person's TDEE; yours can differ by roughly 10%. The weight trend shows what really happens: eating
 * `avgIntake` per day while the weight moves `slope` kg per day means the body spends avgIntake - slope x (energy per kg of the change).
 * This module measures that over the last four weeks and decides how far to move the formula towards it.
 *
 * Two honest limits. (1) The energy in a kilo of change depends on what it is made of: lost weight is mostly fat (about 7,700 kcal/kg, the
 * usual figure, which already overstates a little because the body's own spending falls as it shrinks), but gained weight is part lean tissue,
 * which stores far less (fat is about 9,300 kcal/kg, lean mass a fraction of that), so a gain is valued lower. Using 7,700 for a gain would
 * read the body as burning too little and push the target down - the wrong way for someone building muscle. (2) People under-report what they
 * eat, often by 10-20%. That is not corrected for: if the user logs the same way every day, the result is the intake that keeps them steady
 * *as they log it*, which is the number they need to hit.
 */

/** Largest personal correction the app will apply, in kcal per day. */
export const MAX_TDEE_ADJUSTMENT_KCAL = 500;

/** Energy per kg of weight lost (mostly fat) and of weight gained (a mix of lean tissue and fat), with how uncertain each figure is. */
const KCAL_PER_KG_LOST = 7700;
const KCAL_PER_KG_GAINED = 5500;
const KCAL_PER_KG_LOST_SD = 800;
const KCAL_PER_KG_GAINED_SD = 1500;
const WINDOW_DAYS = 28;
/** Food days needed: fewer and the average intake says little about a typical day. */
export const MIN_LOGGED_DAYS = 14;
/** Weigh-ins needed, spread over at least MIN_SPAN_DAYS: a trend from two or three readings is mostly water and salt. */
export const MIN_WEIGH_INS = 8;
export const MIN_SPAN_DAYS = 14;
/** A day with less than this logged is treated as partly logged and ignored. */
const MIN_FULL_DAY_KCAL = 1000;

/** How far an individual's real TDEE typically sits from the formula (1 standard deviation), and the error of the food log itself. */
const FORMULA_SD_KCAL = 250;
const FOOD_LOG_SD_KCAL = 100;
const ROUND_TO_KCAL = 25;
/** Smaller changes than this are not worth interrupting the user for. */
const MIN_WORTH_CHANGE_KCAL = 75;

const dayIndex = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

export interface CalibrationProgress {
  status: 'collecting';
  loggedDays: number;
  weighIns: number;
  spanDays: number;
}

export interface CalibrationObservation {
  status: 'ready';
  /** TDEE implied by what was eaten (as logged) and how the weight moved. */
  observedTdee: number;
  avgIntake: number;
  /** Weight change per week over the window (negative when losing). */
  slopeKgPerWeek: number;
  /** One standard deviation of the observed TDEE: how scattered the weigh-ins are, and what the weight change is made of. */
  uncertaintyKcal: number;
  loggedDays: number;
  weighIns: number;
}

/** Looks at the four weeks before `today` (today itself is incomplete) and either measures the TDEE or reports how far from enough data the user is. */
export function observeTdee(foodLog: FoodEntry[], weightLogs: WeightLog[], today: string): CalibrationObservation | CalibrationProgress {
  const end = dayIndex(today) - 1;
  const start = end - (WINDOW_DAYS - 1);

  const intakeByDay = new Map<number, number>();
  for (const f of foodLog) {
    const day = dayIndex(f.date);
    if (day >= start && day <= end) intakeByDay.set(day, (intakeByDay.get(day) ?? 0) + f.calories);
  }
  const fullDays = [...intakeByDay.values()].filter((kcal) => kcal >= MIN_FULL_DAY_KCAL);

  const weightByDay = new Map<number, number[]>();
  for (const w of weightLogs) {
    const day = dayIndex(w.date);
    if (day >= start && day <= end) weightByDay.set(day, [...(weightByDay.get(day) ?? []), w.weightKg]);
  }
  const points = [...weightByDay.entries()].map(([day, kg]) => ({ t: day, w: kg.reduce((a, b) => a + b, 0) / kg.length }));
  const spanDays = points.length > 0 ? Math.max(...points.map((p) => p.t)) - Math.min(...points.map((p) => p.t)) : 0;

  if (fullDays.length < MIN_LOGGED_DAYS || points.length < MIN_WEIGH_INS || spanDays < MIN_SPAN_DAYS) {
    return { status: 'collecting', loggedDays: fullDays.length, weighIns: points.length, spanDays };
  }

  // Least-squares line through the weigh-ins: its slope is the weight change per day, and the scatter around it gives the uncertainty.
  const n = points.length;
  const meanT = points.reduce((a, p) => a + p.t, 0) / n;
  const meanW = points.reduce((a, p) => a + p.w, 0) / n;
  const sxx = points.reduce((a, p) => a + (p.t - meanT) ** 2, 0);
  const slope = points.reduce((a, p) => a + (p.t - meanT) * (p.w - meanW), 0) / sxx;
  const intercept = meanW - slope * meanT;
  const sse = points.reduce((a, p) => a + (p.w - (intercept + slope * p.t)) ** 2, 0);
  const slopeSe = Math.sqrt(sse / (n - 2) / sxx);

  const avgIntake = fullDays.reduce((a, b) => a + b, 0) / fullDays.length;
  const kcalPerKg = slope > 0 ? KCAL_PER_KG_GAINED : KCAL_PER_KG_LOST;
  const kcalPerKgSd = slope > 0 ? KCAL_PER_KG_GAINED_SD : KCAL_PER_KG_LOST_SD;
  // Two independent sources of doubt: how scattered the weigh-ins are, and what the weight change is made of.
  const uncertainty = Math.sqrt((slopeSe * kcalPerKg) ** 2 + (slope * kcalPerKgSd) ** 2);
  return {
    status: 'ready',
    observedTdee: Math.round(avgIntake - slope * kcalPerKg),
    avgIntake: Math.round(avgIntake),
    slopeKgPerWeek: Math.round(slope * 7 * 100) / 100,
    uncertaintyKcal: Math.round(uncertainty),
    loggedDays: fullDays.length,
    weighIns: n,
  };
}

export interface CalibrationSuggestion {
  /** The correction to add to the formula's TDEE (not to the current target), rounded to 25 kcal. */
  suggestedAdjustment: number;
  /** Observed TDEE minus the formula's, the whole gap before it is softened. */
  rawGap: number;
  /** What share of the gap is applied: the noisier the weight trend, the less it is trusted over the formula. */
  trust: number;
  /** How much the suggestion differs from the correction already applied. */
  change: number;
  worthSuggesting: boolean;
}

/**
 * Moves the formula towards the observation by how much each is trusted: the formula is off by about 250 kcal for an individual, the observation by
 * the scatter of the weigh-ins plus the food log's own error. A noisy trend therefore moves the target only a little; a clean one nearly all the way.
 */
export function suggestAdjustment(observation: CalibrationObservation, formulaTdee: number, currentAdjustment: number): CalibrationSuggestion {
  const rawGap = observation.observedTdee - formulaTdee;
  const observationVariance = observation.uncertaintyKcal ** 2 + FOOD_LOG_SD_KCAL ** 2;
  const formulaVariance = FORMULA_SD_KCAL ** 2;
  const trust = formulaVariance / (formulaVariance + observationVariance);

  const softened = Math.round((rawGap * trust) / ROUND_TO_KCAL) * ROUND_TO_KCAL;
  const suggestedAdjustment = Math.max(-MAX_TDEE_ADJUSTMENT_KCAL, Math.min(MAX_TDEE_ADJUSTMENT_KCAL, softened));
  const change = suggestedAdjustment - currentAdjustment;
  return { suggestedAdjustment, rawGap, trust: Math.round(trust * 100) / 100, change, worthSuggesting: Math.abs(change) >= MIN_WORTH_CHANGE_KCAL };
}

/** Sets (or, with 0, removes) the personal TDEE correction and recalculates the calorie and macro targets from it. */
export function applyTdeeAdjustment(prev: AppState, adjustment: number): AppState {
  const value = Math.max(-MAX_TDEE_ADJUSTMENT_KCAL, Math.min(MAX_TDEE_ADJUSTMENT_KCAL, Math.round(adjustment)));
  const { tdeeAdjustmentKcal: _previous, ...rest } = prev.profile.metrics;
  const metrics = value === 0 ? rest : { ...rest, tdeeAdjustmentKcal: value };
  return { ...prev, profile: { ...prev.profile, metrics }, nutritionPlan: calculateNutritionPlan(metrics) };
}
