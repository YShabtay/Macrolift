import type { AppState, FoodEntry, Goal, GoalIntensity, WeightLog } from '../types/fitness';
import { calculateNutritionPlan } from './calculations';
import { KCAL_PER_KG_GAINED, KCAL_PER_KG_LOST } from './calibration';
import { dayIndex, fitWeightTrend, spanDays as spanOf, weighInPoints } from './weightTrend';

/**
 * Checks the calorie target against what the weight actually does, using only the weigh-ins (food logging is optional). After two to three
 * weeks it compares the weekly trend with the pace the user's goal calls for, and when the two clearly differ it suggests adding or removing
 * calories. The user can accept, change the amount or ignore it; accepting moves the whole calorie range and starts a new check.
 */

/** The largest correction the app will keep on top of the plan, in kcal per day. */
export const MAX_TARGET_ADJUSTMENT_KCAL = 600;
const WINDOW_DAYS = 21;
export const MIN_CHECK_WEIGH_INS = 6;
export const MIN_CHECK_SPAN_DAYS = 14;
const MIN_FULL_DAY_KCAL = 1000;
const MIN_LOGGED_DAYS_FOR_ADHERENCE = 7;
/** How far the logged intake may sit from the target before a weight trend is put down to eating differently rather than to the target. */
const ADHERENCE_TOLERANCE_KCAL = 200;
const MIN_SUGGESTION_KCAL = 100;
const MAX_SUGGESTION_KCAL = 300;
const ROUND_TO_KCAL = 50;

/** The weekly weight change each goal calls for, as a share of body weight (negative = losing). */
export function expectedWeeklyChange(goal: Goal, intensity: GoalIntensity | undefined): { min: number; max: number } {
  switch (goal) {
    case 'gain_muscle':
      return intensity === 'aggressive' ? { min: 0.005, max: 0.01 } : { min: 0.0025, max: 0.005 };
    case 'lose_weight':
      return { min: -0.01, max: -0.005 };
    case 'recomp':
      return { min: -0.005, max: 0.0025 };
    case 'maintain':
    default:
      return { min: -0.0025, max: 0.0025 };
  }
}

export interface TargetCheckProgress {
  status: 'collecting';
  weighIns: number;
  spanDays: number;
}

export type TargetVerdict =
  | 'on-track' // the weekly trend is inside the expected pace
  | 'unclear' // a little outside it, but the weigh-ins are too scattered to say
  | 'add' // clearly below the expected pace: suggest adding calories
  | 'reduce' // clearly above it: suggest removing calories
  | 'reach-target' // below the pace, but the logged food is below the target too: eat the target first
  | 'hold-target'; // above the pace, but the logged food is above the target too: eat the target first

export interface TargetCheckResult {
  status: 'ready';
  verdict: TargetVerdict;
  /** Weekly change measured from the weigh-ins, in kg (negative = losing), with its uncertainty. */
  slopeKgPerWeek: number;
  uncertaintyKgPerWeek: number;
  /** The pace the goal calls for, in kg per week. */
  expectedKgPerWeek: { min: number; max: number };
  /** Suggested change to the daily target (positive = add); 0 unless the verdict is 'add' or 'reduce'. */
  suggestedDeltaKcal: number;
  /** Average logged intake over the window when enough days were logged, else null. */
  avgIntake: number | null;
  weighIns: number;
  spanDays: number;
}

const isoOf = (day: number): string => new Date(day * 86_400_000).toISOString().slice(0, 10);

export function checkTarget(params: {
  weightLogs: WeightLog[];
  foodLog: FoodEntry[];
  goal: Goal;
  intensity?: GoalIntensity;
  weightKg: number;
  targetCalories: number;
  /** The day the current target took effect: weigh-ins before it say nothing about it. */
  since: string;
  today: string;
}): TargetCheckProgress | TargetCheckResult {
  const { weightLogs, foodLog, goal, intensity, weightKg, targetCalories, since, today } = params;
  const windowStart = isoOf(Math.max(dayIndex(today) - (WINDOW_DAYS - 1), dayIndex(since)));
  const points = weighInPoints(weightLogs, windowStart, today);
  const span = spanOf(points);
  const trend = points.length >= MIN_CHECK_WEIGH_INS && span >= MIN_CHECK_SPAN_DAYS ? fitWeightTrend(points) : null;
  if (!trend) return { status: 'collecting', weighIns: points.length, spanDays: span };

  const slope = trend.slopePerDay * 7;
  const se = trend.slopeSe * 7;
  const expected = expectedWeeklyChange(goal, intensity);
  const lo = expected.min * weightKg;
  const hi = expected.max * weightKg;
  const mid = (lo + hi) / 2;

  // Intake, only to tell "the target is off" from "the target was not followed".
  const byDay = new Map<number, number>();
  for (const f of foodLog) {
    const day = dayIndex(f.date);
    if (day >= dayIndex(windowStart) && day <= dayIndex(today) - 1) byDay.set(day, (byDay.get(day) ?? 0) + f.calories);
  }
  const fullDays = [...byDay.values()].filter((kcal) => kcal >= MIN_FULL_DAY_KCAL);
  const avgIntake = fullDays.length >= MIN_LOGGED_DAYS_FOR_ADHERENCE ? Math.round(fullDays.reduce((a, b) => a + b, 0) / fullDays.length) : null;

  let verdict: TargetVerdict;
  let suggestedDeltaKcal = 0;
  if (slope + se < lo) {
    if (avgIntake !== null && avgIntake < targetCalories - ADHERENCE_TOLERANCE_KCAL) verdict = 'reach-target';
    else verdict = 'add';
  } else if (slope - se > hi) {
    if (avgIntake !== null && avgIntake > targetCalories + ADHERENCE_TOLERANCE_KCAL) verdict = 'hold-target';
    else verdict = 'reduce';
  } else if (slope >= lo && slope <= hi) {
    verdict = 'on-track';
  } else {
    verdict = 'unclear';
  }

  if (verdict === 'add' || verdict === 'reduce') {
    const need = mid - slope; // kg per week the trend must move towards the middle of the expected pace
    const kcalPerKg = mid > 0 ? KCAL_PER_KG_GAINED : KCAL_PER_KG_LOST;
    const raw = (need * kcalPerKg) / 7;
    const size = Math.min(Math.max(Math.round(Math.abs(raw) / ROUND_TO_KCAL) * ROUND_TO_KCAL, MIN_SUGGESTION_KCAL), MAX_SUGGESTION_KCAL);
    suggestedDeltaKcal = verdict === 'add' ? size : -size;
  }

  return {
    status: 'ready',
    verdict,
    slopeKgPerWeek: Math.round(slope * 100) / 100,
    uncertaintyKgPerWeek: Math.round(se * 100) / 100,
    expectedKgPerWeek: { min: Math.round(lo * 100) / 100, max: Math.round(hi * 100) / 100 },
    suggestedDeltaKcal,
    avgIntake,
    weighIns: points.length,
    spanDays: span,
  };
}

/** The day to count the next check from: when the user last accepted a correction, otherwise when the profile was made. */
export function getCheckStart(metrics: { targetAdjustmentDate?: string }, profileCreatedAt: string): string {
  return metrics.targetAdjustmentDate ?? profileCreatedAt.slice(0, 10);
}

/**
 * Adds `deltaKcal` to the correction already on the profile (positive = eat more), recalculates the calorie range and macros from it, and
 * starts the next check from `today`. A correction that nets out to zero is removed.
 */
export function applyTargetAdjustment(prev: AppState, deltaKcal: number, today: string): AppState {
  const current = prev.profile.metrics.targetAdjustmentKcal ?? 0;
  const next = Math.max(-MAX_TARGET_ADJUSTMENT_KCAL, Math.min(MAX_TARGET_ADJUSTMENT_KCAL, Math.round(current + deltaKcal)));
  const { targetAdjustmentKcal: _previous, ...rest } = prev.profile.metrics;
  const metrics = { ...rest, ...(next !== 0 ? { targetAdjustmentKcal: next } : {}), targetAdjustmentDate: today };
  return { ...prev, profile: { ...prev.profile, metrics }, nutritionPlan: calculateNutritionPlan(metrics) };
}
