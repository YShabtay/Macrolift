import type { NutritionPlan } from '../types/fitness';

export interface CalorieRange {
  min: number;
  max: number;
  /** Which end the target starts at: 'low' for a surplus goal, 'high' for a deficit goal, 'middle' for maintenance and recomposition. */
  start: 'low' | 'high' | 'middle';
}

/** The calorie range of a plan, or null for plans stored before ranges existed (they are recalculated on load, so this is rare). */
export function getCalorieRange(plan: NutritionPlan): CalorieRange | null {
  if (plan.targetMin === undefined || plan.targetMax === undefined || plan.targetMax <= plan.targetMin) return null;
  const offset = plan.intendedOffsetKcal ?? 0;
  return { min: plan.targetMin, max: plan.targetMax, start: offset > 50 ? 'low' : offset < -50 ? 'high' : 'middle' };
}

/** One short line for a card: the range and where the user starts in it. */
export function describeRangeShort(range: CalorieRange): string {
  const where = range.start === 'low' ? 'מתחילים מהקצה הנמוך' : range.start === 'high' ? 'מתחילים מהקצה הגבוה' : 'מתחילים מהאמצע';
  return `טווח מומלץ: ${range.min.toLocaleString('he-IL')}-${range.max.toLocaleString('he-IL')} קק״ל · ${where}`;
}
