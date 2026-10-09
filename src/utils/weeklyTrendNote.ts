import type { Goal, GoalIntensity, WeightLog } from '../types/fitness';
import { KCAL_PER_KG_GAINED, KCAL_PER_KG_LOST } from './calibration';
import { expectedWeeklyChange } from './targetCheck';
import { addDaysIso } from './dateMath';
import { buildWeeklySummaries, getWeekStart } from './weightCalculations';

/**
 * A plain memory of the last few weekly averages: when 3 (or 4) completed weeks in a row all move the wrong way for the goal, say so and suggest a calorie
 * change. It looks only at weeks that started after the last change to the target, so a correction gets time to work before the next advice.
 */

/** Consecutive completed weeks needed before anything is said. */
export const MIN_TREND_WEEKS = 3;
export const MAX_TREND_WEEKS = 4;
/** A weigh-in count below this makes a weekly average too shaky to count. */
const MIN_WEEK_WEIGH_INS = 2;
/** A week-to-week change smaller than this is treated as no change. */
const FLAT_KG = 0.05;
const MIN_SUGGESTION_KCAL = 100;
const MAX_SUGGESTION_KCAL = 300;
const ROUND_TO_KCAL = 50;

export type TrendKind = 'behind' | 'ahead' | 'drifting-up' | 'drifting-down';

export interface WeeklyTrendNote {
  kind: TrendKind;
  /** The weeks in a row that moved the same wrong way, oldest first. */
  weeks: { weekStart: string; averageKg: number }[];
  /** Average change per week over those weeks (negative = losing). */
  avgChangeKgPerWeek: number;
  /** Suggested change to the daily target (positive = eat more). */
  suggestedDeltaKcal: number;
  /** True when the advice is to eat more. */
  eatMore: boolean;
}

/** The last run (up to four) of consecutive completed weeks that have enough weigh-ins, ending at the most recent one. */
function consecutiveWeeks(weightLogs: WeightLog[], today: string, since: string) {
  const currentWeek = getWeekStart(today);
  // Only weeks that began on or after the first Sunday on or after the last target change, so the weeks being judged all ran on the current target.
  let firstWeek = getWeekStart(since);
  if (firstWeek < since) firstWeek = addDaysIso(firstWeek, 7);
  const eligible = buildWeeklySummaries(weightLogs).filter((w) => w.weekStart < currentWeek && w.weekStart >= firstWeek && w.daysLogged >= MIN_WEEK_WEIGH_INS);
  const run: typeof eligible = [];
  for (let i = eligible.length - 1; i >= 0; i--) {
    if (run.length > 0 && addDaysIso(eligible[i].weekStart, 7) !== run[0].weekStart) break;
    run.unshift(eligible[i]);
    if (run.length === MAX_TREND_WEEKS) break;
  }
  return run;
}

export function getWeeklyTrendNote(params: {
  weightLogs: WeightLog[];
  goal: Goal;
  intensity?: GoalIntensity;
  weightKg: number;
  today: string;
  /** The day the current calorie target took effect (the last accepted change, else the profile's start). */
  since: string;
}): WeeklyTrendNote | null {
  const { weightLogs, goal, intensity, weightKg, today, since } = params;
  const run = consecutiveWeeks(weightLogs, today, since);
  if (run.length < MIN_TREND_WEEKS) return null;

  const deltas = run.slice(1).map((w, i) => w.averageKg - run[i].averageKg);
  const expected = expectedWeeklyChange(goal, intensity);
  const lo = expected.min * weightKg - FLAT_KG;
  const hi = expected.max * weightKg + FLAT_KG;
  const allBelow = deltas.every((d) => d < lo);
  const allAbove = deltas.every((d) => d > hi);
  if (!allBelow && !allAbove) return null;

  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const mid = ((expected.min + expected.max) / 2) * weightKg;
  const need = mid - avg; // kg a week the trend must move toward the middle of the expected pace
  const kcalPerKg = mid > 0 ? KCAL_PER_KG_GAINED : KCAL_PER_KG_LOST;
  const raw = (need * kcalPerKg) / 7;
  const size = Math.min(Math.max(Math.round(Math.abs(raw) / ROUND_TO_KCAL) * ROUND_TO_KCAL, MIN_SUGGESTION_KCAL), MAX_SUGGESTION_KCAL);
  const eatMore = need > 0;

  const kind: TrendKind =
    goal === 'gain_muscle' ? (allBelow ? 'behind' : 'ahead') : goal === 'lose_weight' ? (allAbove ? 'behind' : 'ahead') : allAbove ? 'drifting-up' : 'drifting-down';

  return {
    kind,
    weeks: run.map((w) => ({ weekStart: w.weekStart, averageKg: w.averageKg })),
    avgChangeKgPerWeek: Math.round(avg * 100) / 100,
    suggestedDeltaKcal: eatMore ? size : -size,
    eatMore,
  };
}

/** The note's one-line headline, in plain words for the goal. */
export function describeTrendNote(note: WeeklyTrendNote): string {
  const n = note.weeks.length;
  switch (note.kind) {
    case 'behind':
      return `הממוצע השבועי לא מתקדם אל המטרה כבר ${n} שבועות ברצף`;
    case 'ahead':
      return `הממוצע השבועי זז מהר מהקצב המתוכנן כבר ${n} שבועות ברצף`;
    case 'drifting-up':
      return `הממוצע השבועי עולה כבר ${n} שבועות ברצף`;
    case 'drifting-down':
      return `הממוצע השבועי יורד כבר ${n} שבועות ברצף`;
  }
}
