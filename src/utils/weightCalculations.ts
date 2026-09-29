import type { WeightLog } from '../types/fitness';

// ---------------------------------------------------------------------------
// Local-time date helpers (avoid UTC-shift bugs from `new Date(isoString)`)
// ---------------------------------------------------------------------------

export function todayIso(): string {
  return formatIsoDate(new Date());
}

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Short Hebrew-locale display format, e.g. "12.03". */
export function formatDateDisplay(dateStr: string): string {
  const date = parseIsoDate(dateStr);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}`;
}

const HEBREW_MONTH_NAMES = [
  'בינואר',
  'בפברואר',
  'במרץ',
  'באפריל',
  'במאי',
  'ביוני',
  'ביולי',
  'באוגוסט',
  'בספטמבר',
  'באוקטובר',
  'בנובמבר',
  'בדצמבר',
];

/** Long, readable Hebrew display format, e.g. "15 במרץ 2026". */
export function formatDateLong(dateStr: string): string {
  const date = parseIsoDate(dateStr);
  return `${date.getDate()} ${HEBREW_MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function daysBetween(dateStrA: string, dateStrB: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = parseIsoDate(dateStrA).getTime();
  const b = parseIsoDate(dateStrB).getTime();
  return Math.round((b - a) / msPerDay);
}

export function daysSince(dateStr: string): number {
  return daysBetween(dateStr, todayIso());
}

// ---------------------------------------------------------------------------
// Weekly grouping (calendar weeks, Sunday - Saturday)
// ---------------------------------------------------------------------------

/** Returns the ISO date of the Sunday that starts the week containing `dateStr`. */
export function getWeekStart(dateStr: string): string {
  const date = parseIsoDate(dateStr);
  date.setDate(date.getDate() - date.getDay());
  return formatIsoDate(date);
}

/** Returns the ISO date of the Saturday that ends the week containing `dateStr`. */
export function getWeekEnd(dateStr: string): string {
  const date = parseIsoDate(getWeekStart(dateStr));
  date.setDate(date.getDate() + 6);
  return formatIsoDate(date);
}

export interface WeeklyWeightSummary {
  weekStart: string;
  weekEnd: string;
  averageKg: number;
  daysLogged: number;
  entries: WeightLog[];
  /** averageKg minus the previous week's averageKg; null when there's no previous week to compare to. */
  deltaFromPreviousWeek: number | null;
}

/** Builds one summary per calendar week that has at least one log, sorted oldest -> newest. */
export function buildWeeklySummaries(logs: WeightLog[]): WeeklyWeightSummary[] {
  const byWeek = new Map<string, WeightLog[]>();

  for (const log of logs) {
    const weekStart = getWeekStart(log.date);
    const bucket = byWeek.get(weekStart);
    if (bucket) bucket.push(log);
    else byWeek.set(weekStart, [log]);
  }

  const summaries: WeeklyWeightSummary[] = Array.from(byWeek.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([weekStart, entries]) => {
      const sortedEntries = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const averageKg = sortedEntries.reduce((sum, e) => sum + e.weightKg, 0) / sortedEntries.length;
      return {
        weekStart,
        weekEnd: getWeekEnd(weekStart),
        averageKg: Math.round(averageKg * 10) / 10,
        daysLogged: sortedEntries.length,
        entries: sortedEntries,
        deltaFromPreviousWeek: null,
      };
    });

  for (let i = 1; i < summaries.length; i++) {
    summaries[i].deltaFromPreviousWeek =
      Math.round((summaries[i].averageKg - summaries[i - 1].averageKg) * 10) / 10;
  }

  return summaries;
}

export function getLatestWeekSummary(logs: WeightLog[]): WeeklyWeightSummary | null {
  const summaries = buildWeeklySummaries(logs);
  return summaries.length > 0 ? summaries[summaries.length - 1] : null;
}

export function getLogForDate(logs: WeightLog[], dateStr: string): WeightLog | undefined {
  return logs.find((l) => l.date === dateStr);
}

/**
 * Finds the closest logged weight to `dateStr` within `maxDays`, preferring an
 * exact match. Used to estimate bodyweight around a progress-photo date.
 */
export function findWeightNearDate(logs: WeightLog[], dateStr: string, maxDays = 7): number | undefined {
  const exact = getLogForDate(logs, dateStr);
  if (exact) return exact.weightKg;

  let closest: WeightLog | undefined;
  let closestDistance = Infinity;
  for (const log of logs) {
    const distance = Math.abs(daysBetween(log.date, dateStr));
    if (distance <= maxDays && distance < closestDistance) {
      closest = log;
      closestDistance = distance;
    }
  }
  return closest?.weightKg;
}

/**
 * Best-effort bodyweight estimate for a given date: prefers that date's
 * calendar-week average (smooths out daily fluid swings), falling back to
 * the closest logged day within a week.
 */
export function estimateWeightForDate(logs: WeightLog[], dateStr: string): number | undefined {
  const weekStart = getWeekStart(dateStr);
  const week = buildWeeklySummaries(logs).find((s) => s.weekStart === weekStart);
  return week ? week.averageKg : findWeightNearDate(logs, dateStr);
}
