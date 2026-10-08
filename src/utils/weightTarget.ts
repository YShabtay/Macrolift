import type { Goal, UserMetrics, WeightLog } from '../types/fitness';
import { expectedWeeklyChange } from './targetCheck';
import { dayIndex, fitWeightTrend, spanDays, weighInPoints } from './weightTrend';
import { buildWeeklySummaries } from './weightCalculations';

/**
 * A target body weight, always judged on weekly averages like the rest of the app: one weigh-in never says "reached" or "far". The target is
 * about the scale only - during a bulk part of the gain is fat - so the circumference measurements remain the check on what is being gained.
 */

export const TARGET_WEIGHT_MIN_KG = 35;
export const TARGET_WEIGHT_MAX_KG = 250;
/** The weekly average counts as at the target when it is this close (scale noise). */
const REACHED_TOLERANCE_KG = 0.2;
/** Consecutive weeks at the target before the app calls it reached. */
export const REACHED_WEEKS = 2;
/** A week needs at least this many weigh-ins to count toward "reached". */
const MIN_WEEK_LOGS = 2;
const PACE_WINDOW_DAYS = 28;
const MIN_PACE_POINTS = 6;
const MIN_PACE_SPAN_DAYS = 14;
/** Below this weekly pace the trend is treated as flat. */
const MIN_PACE_KG_PER_WEEK = 0.05;
const MAX_ETA_WEEKS = 52;
const BMI_LOW = 18.5;
const BMI_HIGH = 30;

export interface TargetWeightCheck {
  ok: boolean;
  /** Blocks saving. */
  error?: string;
  /** Allowed, but worth reading. */
  warning?: string;
}

/** Whether a target makes sense for the user's goal and body. The goal decides the direction: gaining muscle cannot aim below the current weight. */
export function validateWeightTarget(params: { targetKg: number; currentKg: number; heightCm: number; goal: Goal }): TargetWeightCheck {
  const { targetKg, currentKg, heightCm, goal } = params;
  if (!Number.isFinite(targetKg) || targetKg < TARGET_WEIGHT_MIN_KG || targetKg > TARGET_WEIGHT_MAX_KG) {
    return { ok: false, error: `משקל היעד צריך להיות בין ${TARGET_WEIGHT_MIN_KG} ל-${TARGET_WEIGHT_MAX_KG} ק״ג.` };
  }
  if (goal === 'gain_muscle' && targetKg < currentKg - 0.5) {
    return { ok: false, error: 'המטרה היא מסה מבוקרת, אבל משקל היעד נמוך מהמשקל הנוכחי. אפשר לשנות את המטרה או את היעד.' };
  }
  if (goal === 'lose_weight' && targetKg > currentKg + 0.5) {
    return { ok: false, error: 'המטרה היא חיטוב, אבל משקל היעד גבוה מהמשקל הנוכחי. אפשר לשנות את המטרה או את היעד.' };
  }
  const bmi = targetKg / (heightCm / 100) ** 2;
  if (bmi < BMI_LOW) return { ok: true, warning: 'משקל היעד נמוך מהטווח התקין לגובה שלך (BMI מתחת ל-18.5). כדאי להתייעץ עם איש מקצוע.' };
  if (bmi > BMI_HIGH && goal === 'gain_muscle') {
    return { ok: true, warning: 'משקל היעד גבוה (BMI מעל 30). בעלייה כזו חלק גדול מהמשקל יהיה שומן, ושווה לעקוב גם אחרי ההיקפים.' };
  }
  if (goal === 'maintain' && Math.abs(targetKg - currentKg) > 2) {
    return { ok: true, warning: 'המטרה היא שמירה, אבל היעד רחוק מהמשקל הנוכחי. אם רוצים להגיע אליו, כדאי לבחור מסה או חיטוב.' };
  }
  return { ok: true };
}

/** The weight the app compares with the target: the average of the last 7 days of weigh-ins, else the latest one, else the profile's weight. */
export function getCurrentWeight(weightLogs: WeightLog[], profileKg: number, today: string): { kg: number; basis: 'week-average' | 'latest' | 'profile' } {
  const t = dayIndex(today);
  const recent = weightLogs.filter((l) => dayIndex(l.date) > t - 7 && dayIndex(l.date) <= t);
  if (recent.length > 0) return { kg: round1(recent.reduce((a, l) => a + l.weightKg, 0) / recent.length), basis: 'week-average' };
  const past = weightLogs.filter((l) => dayIndex(l.date) <= t).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (past.length > 0) return { kg: past[0].weightKg, basis: 'latest' };
  return { kg: profileKg, basis: 'profile' };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The weight to start counting progress from: the one saved when the target was set, else the first weigh-in, else the profile's. */
export function getStartWeight(metrics: UserMetrics, weightLogs: WeightLog[]): number {
  if (metrics.targetWeightStartKg && metrics.targetWeightStartKg > 0) return metrics.targetWeightStartKg;
  const first = [...weightLogs].sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return first?.weightKg ?? metrics.weightKg;
}

export interface WeightTargetProgress {
  status: 'active' | 'reached';
  direction: 'gain' | 'lose';
  startKg: number;
  targetKg: number;
  currentKg: number;
  currentBasis: 'week-average' | 'latest' | 'profile';
  /** Kg still to go (0 once reached). */
  remainingKg: number;
  /** 0-100, how much of the way from the start to the target has been covered. */
  percent: number;
  /** Measured weekly change toward the target (negative = moving away), or null when there are too few weigh-ins. */
  paceKgPerWeek: number | null;
  trend: 'toward' | 'away' | 'flat' | 'unknown';
  /** Rough weeks left, a range; `maxWeeks` null means more than a year. */
  eta: { minWeeks: number; maxWeeks: number | null; basis: 'measured' | 'expected' } | null;
  /** Consecutive recent weeks whose average was at the target. */
  weeksAtTarget: number;
}

function crossed(avg: number, targetKg: number, direction: 'gain' | 'lose'): boolean {
  return direction === 'gain' ? avg >= targetKg - REACHED_TOLERANCE_KG : avg <= targetKg + REACHED_TOLERANCE_KG;
}

/** Where the user stands against their target weight; null when no target is set. */
export function getWeightTargetProgress(params: { metrics: UserMetrics; weightLogs: WeightLog[]; today: string }): WeightTargetProgress | null {
  const { metrics, weightLogs, today } = params;
  const targetKg = metrics.targetWeightKg;
  if (!targetKg || targetKg <= 0) return null;

  const startKg = getStartWeight(metrics, weightLogs);
  const current = getCurrentWeight(weightLogs, metrics.weightKg, today);
  const direction: 'gain' | 'lose' = targetKg >= startKg ? 'gain' : 'lose';
  const sign = direction === 'gain' ? 1 : -1;

  const weeks = buildWeeklySummaries(weightLogs.filter((l) => l.date <= today)).filter((w) => w.daysLogged >= MIN_WEEK_LOGS);
  let weeksAtTarget = 0;
  for (let i = weeks.length - 1; i >= 0 && crossed(weeks[i].averageKg, targetKg, direction); i--) weeksAtTarget++;
  const reached = weeksAtTarget >= REACHED_WEEKS;

  const span = Math.abs(targetKg - startKg);
  const covered = (current.kg - startKg) * sign;
  const percent = reached ? 100 : span > 0 ? Math.max(0, Math.min(Math.round((covered / span) * 100), 99)) : 0;
  const remainingKg = reached ? 0 : Math.max(round1((targetKg - current.kg) * sign), 0);

  const from = new Date((dayIndex(today) - (PACE_WINDOW_DAYS - 1)) * 86_400_000).toISOString().slice(0, 10);
  const points = weighInPoints(weightLogs, from, today);
  const trendFit = points.length >= MIN_PACE_POINTS && spanDays(points) >= MIN_PACE_SPAN_DAYS ? fitWeightTrend(points) : null;
  const toward = trendFit ? trendFit.slopePerDay * 7 * sign : null;
  const se = trendFit ? trendFit.slopeSe * 7 : 0;
  const paceKgPerWeek = toward === null ? null : Math.round(toward * 100) / 100;
  const trend: WeightTargetProgress['trend'] =
    toward === null ? 'unknown' : toward >= MIN_PACE_KG_PER_WEEK && toward > se ? 'toward' : toward <= -MIN_PACE_KG_PER_WEEK && -toward > se ? 'away' : 'flat';

  let eta: WeightTargetProgress['eta'] = null;
  if (!reached && remainingKg >= REACHED_TOLERANCE_KG) {
    if (trend === 'toward' && toward !== null) {
      const fast = toward + se;
      const slow = toward - se;
      eta = { minWeeks: weeksFor(remainingKg, fast), maxWeeks: slow > MIN_PACE_KG_PER_WEEK ? capWeeks(weeksFor(remainingKg, slow)) : null, basis: 'measured' };
    } else if ((metrics.goal === 'gain_muscle' && direction === 'gain') || (metrics.goal === 'lose_weight' && direction === 'lose')) {
      const rate = expectedWeeklyChange(metrics.goal, metrics.goalIntensity);
      const lo = Math.abs(rate.min) * current.kg;
      const hi = Math.abs(rate.max) * current.kg;
      eta = { minWeeks: weeksFor(remainingKg, Math.max(lo, hi)), maxWeeks: capWeeks(weeksFor(remainingKg, Math.min(lo, hi))), basis: 'expected' };
    }
  }

  return {
    status: reached ? 'reached' : 'active',
    direction,
    startKg,
    targetKg,
    currentKg: current.kg,
    currentBasis: current.basis,
    remainingKg,
    percent,
    paceKgPerWeek,
    trend,
    eta,
    weeksAtTarget,
  };
}

const weeksFor = (remainingKg: number, kgPerWeek: number): number => Math.max(1, Math.round(remainingKg / kgPerWeek));
const capWeeks = (weeks: number): number | null => (weeks > MAX_ETA_WEEKS ? null : weeks);

/**
 * Keeps the target weight consistent with the rest of the profile when it is edited: a new or changed target starts counting progress from the
 * current weekly average, clearing it clears the start too, and a target the (possibly changed) goal can no longer point at is dropped instead of
 * left contradicting the plan.
 */
export function withTargetWeightBookkeeping(before: UserMetrics, updates: Partial<UserMetrics>, weightLogs: WeightLog[], today: string): Partial<UserMetrics> {
  const merged = { ...before, ...updates };
  const currentKg = getCurrentWeight(weightLogs, merged.weightKg, today).kg;
  const target = merged.targetWeightKg;
  if (!target) return 'targetWeightKg' in updates ? { ...updates, targetWeightKg: undefined, targetWeightStartKg: undefined } : updates;
  if (!validateWeightTarget({ targetKg: target, currentKg, heightCm: merged.heightCm, goal: merged.goal }).ok) {
    return { ...updates, targetWeightKg: undefined, targetWeightStartKg: undefined };
  }
  if (target !== before.targetWeightKg) return { ...updates, targetWeightStartKg: currentKg };
  return updates;
}
