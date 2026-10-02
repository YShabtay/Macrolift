/**
 * Whole-number display value for macros (grams) and calories. Sums of food entries, scaled portions and
 * stored plans can carry float noise like 64.99999999999999, so anything shown to the user goes through this.
 * Empty / NaN values become 0.
 */
export const formatMacro = (val: number | undefined | null): number => {
  if (!val || isNaN(val)) return 0;
  return Math.round(val);
};
