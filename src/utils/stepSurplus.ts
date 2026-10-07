import type { StepLog } from '../types/fitness';
import { dayIndex } from './weightTrend';
import { estimateStepCalories } from './stepsCalculations';
import { getWeekStart } from './weightCalculations';

/** Days needed before an average means anything. */
const MIN_DAYS = 2;
/** A difference smaller than this (about 750 steps) is not worth mentioning. */
const MIN_NOTICEABLE_KCAL = 30;

export interface StepSurplus {
  /** Completed days of this week with a step count (days without one are skipped, not counted as zero). */
  days: number;
  averageSteps: number;
  /** The daily step goal the calorie target was built on. */
  goalSteps: number;
  /** Average steps per day above (positive) or below (negative) that goal. */
  diffSteps: number;
  /** What that difference is worth in calories per day (same sign), by weight. */
  kcalPerDay: number;
}

/**
 * How this week's walking compares with the step average the calorie target assumes. The target counts `goalSteps` a day; every day above it burns
 * more than planned and every day below it burns less, so the week's average so far says whether the person probably needs to eat a little more
 * (or less) than the target to keep the pace it was designed for. Only completed days count: today's count is still growing. Null when there is
 * too little data, or the difference is too small to matter.
 */
export function getStepSurplus(params: { stepLogs: StepLog[]; goalSteps: number; weightKg: number; today: string }): StepSurplus | null {
  const { stepLogs, goalSteps, weightKg, today } = params;
  const weekStart = dayIndex(getWeekStart(today));
  const todayIdx = dayIndex(today);
  const counted = stepLogs.filter((s) => {
    const day = dayIndex(s.date);
    return day >= weekStart && day < todayIdx;
  });
  if (counted.length < MIN_DAYS) return null;

  const averageSteps = Math.round(counted.reduce((sum, s) => sum + s.steps, 0) / counted.length);
  const diffSteps = averageSteps - goalSteps;
  const kcalPerDay = Math.sign(diffSteps) * estimateStepCalories(Math.abs(diffSteps), weightKg);
  if (Math.abs(kcalPerDay) < MIN_NOTICEABLE_KCAL) return null;
  return { days: counted.length, averageSteps, goalSteps, diffSteps, kcalPerDay };
}

const rounded = (kcal: number) => Math.round(Math.abs(kcal) / 10) * 10;

/** One sentence for a card: what the week's walking means for how much to eat. */
export function describeStepSurplus(s: StepSurplus): string {
  const avg = s.averageSteps.toLocaleString('he-IL');
  const goal = s.goalSteps.toLocaleString('he-IL');
  const kcal = rounded(s.kcalPerDay).toLocaleString('he-IL');
  if (s.kcalPerDay > 0) {
    return `הלכת בממוצע ${avg} צעדים ביום השבוע, יותר מה-${goal} שהגדרת. זה כ-${kcal} קק״ל ביום שהיעד לא לוקח בחשבון, אז כנראה תצטרך לאכול כ-${kcal} קק״ל יותר מהיעד כדי לשמור על הקצב שתוכנן.`;
  }
  return `הלכת בממוצע ${avg} צעדים ביום השבוע, פחות מה-${goal} שהגדרת. היעד מניח כ-${kcal} קק״ל ביום יותר ממה ששרפת, אז כדי לשמור על הקצב שתוכנן כדאי לאכול כ-${kcal} קק״ל פחות מהיעד, או להישאר בקצה המתאים של הטווח.`;
}
