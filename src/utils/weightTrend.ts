import type { WeightLog } from '../types/fitness';

export const dayIndex = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

export interface WeighInPoint {
  /** Day number (days since 1970). */
  t: number;
  /** The day's weight; several weigh-ins on one day are averaged. */
  w: number;
}

/** One point per day with a weigh-in, for the days from `fromIso` to `toIso` inclusive. */
export function weighInPoints(weightLogs: WeightLog[], fromIso: string, toIso: string): WeighInPoint[] {
  const from = dayIndex(fromIso);
  const to = dayIndex(toIso);
  const byDay = new Map<number, number[]>();
  for (const w of weightLogs) {
    const day = dayIndex(w.date);
    if (day >= from && day <= to) byDay.set(day, [...(byDay.get(day) ?? []), w.weightKg]);
  }
  return [...byDay.entries()].map(([t, kg]) => ({ t, w: kg.reduce((a, b) => a + b, 0) / kg.length })).sort((a, b) => a.t - b.t);
}

export function spanDays(points: WeighInPoint[]): number {
  return points.length > 0 ? points[points.length - 1].t - points[0].t : 0;
}

export interface WeightTrend {
  /** kg per day (positive = gaining). */
  slopePerDay: number;
  /** Standard error of that slope, from how scattered the weigh-ins are around the line. */
  slopeSe: number;
}

/** Least-squares line through the weigh-ins. Needs at least 3 points on at least 2 different days. */
export function fitWeightTrend(points: WeighInPoint[]): WeightTrend | null {
  const n = points.length;
  if (n < 3) return null;
  const meanT = points.reduce((a, p) => a + p.t, 0) / n;
  const meanW = points.reduce((a, p) => a + p.w, 0) / n;
  const sxx = points.reduce((a, p) => a + (p.t - meanT) ** 2, 0);
  if (sxx === 0) return null;
  const slopePerDay = points.reduce((a, p) => a + (p.t - meanT) * (p.w - meanW), 0) / sxx;
  const intercept = meanW - slopePerDay * meanT;
  const sse = points.reduce((a, p) => a + (p.w - (intercept + slopePerDay * p.t)) ** 2, 0);
  return { slopePerDay, slopeSe: Math.sqrt(sse / (n - 2) / sxx) };
}
