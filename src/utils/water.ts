import type { WaterLog } from '../types/fitness';

export const GLASS_ML = 250;
const MAX_DAILY_ML = 10_000;

/** A common rule of thumb of ~35 ml per kg of body weight, rounded to whole glasses and kept within 1.5-4.5 L. */
export function getWaterGoalMl(weightKg: number): number {
  const raw = Math.round((weightKg * 35) / GLASS_ML) * GLASS_ML;
  return Math.min(Math.max(raw, 1500), 4500);
}

export function getWaterForDate(logs: WaterLog[], date: string): number {
  return logs.find((l) => l.date === date)?.ml ?? 0;
}

/** Adds (or, with a negative amount, removes) water for a date. The day's total stays within 0..10 L; a total of 0 removes the entry. */
export function addWaterForDate(logs: WaterLog[], date: string, deltaMl: number): WaterLog[] {
  const next = Math.min(Math.max(getWaterForDate(logs, date) + deltaMl, 0), MAX_DAILY_ML);
  const others = logs.filter((l) => l.date !== date);
  return next === 0 ? others : [...others, { date, ml: next }];
}
