export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 400;

/** Parses a typed weight; null when empty or outside a plausible human range. */
export function parseWeightInput(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n >= MIN_WEIGHT_KG && n <= MAX_WEIGHT_KG ? Math.round(n * 10) / 10 : null;
}
