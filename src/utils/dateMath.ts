import { formatIsoDate, parseIsoDate } from './weightCalculations';

/** `date` (YYYY-MM-DD) shifted by a number of days, in local time. */
export function addDaysIso(date: string, days: number): string {
  const d = parseIsoDate(date);
  d.setDate(d.getDate() + days);
  return formatIsoDate(d);
}
