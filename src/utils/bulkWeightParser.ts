const WEIGHT_MIN = 35;
const WEIGHT_MAX = 250;

const DMY_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_REGEX = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const WEIGHT_TOKEN_REGEX = /^\d{1,3}(?:\.\d{1,2})?$/;

export interface BulkWeightEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export interface BulkWeightParseResult {
  entries: BulkWeightEntry[];
  skippedCount: number;
}

function toIsoDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  // A calendar-impossible date (e.g. 31/02) rolls over to the next month instead of throwing - catch that here.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) return null; // no future weigh-ins

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function extractDate(token: string): string | null {
  const dmy = token.match(DMY_REGEX);
  if (dmy) {
    const [, d, m, y] = dmy;
    return toIsoDate(Number(y), Number(m), Number(d));
  }
  const iso = token.match(ISO_REGEX);
  if (iso) {
    const [, y, m, d] = iso;
    return toIsoDate(Number(y), Number(m), Number(d));
  }
  return null;
}

function extractWeight(token: string): number | null {
  if (!WEIGHT_TOKEN_REGEX.test(token)) return null;
  const value = Number(token);
  if (!Number.isFinite(value) || value < WEIGHT_MIN || value > WEIGHT_MAX) return null;
  return value;
}

/**
 * Parses free-form pasted text (typed, or copied from Excel/Google Sheets) into weigh-in
 * entries - one per line, tolerant of DD/MM/YYYY or YYYY-MM-DD dates, tab/comma/space
 * separated fields, and blank or malformed lines (skipped, never thrown). When the same
 * date appears more than once in the pasted text, the last occurrence wins.
 */
export function parseBulkWeightInput(raw: string): BulkWeightParseResult {
  const byDate = new Map<string, number>();
  let skippedCount = 0;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    try {
      const tokens = line
        .replace(/\t/g, ' ')
        .replace(/,/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

      let date: string | null = null;
      let weight: number | null = null;

      for (const token of tokens) {
        if (date === null) {
          const d = extractDate(token);
          if (d !== null) {
            date = d;
            continue;
          }
        }
        if (weight === null) {
          const w = extractWeight(token);
          if (w !== null) weight = w;
        }
      }

      if (date !== null && weight !== null) {
        byDate.set(date, weight);
      } else {
        skippedCount += 1;
      }
    } catch {
      skippedCount += 1;
    }
  }

  const entries = Array.from(byDate.entries())
    .map(([date, weightKg]) => ({ date, weightKg }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { entries, skippedCount };
}
