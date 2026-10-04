/** Standard Olympic bar and the plate sizes (kg) a normal gym has. */
export const BAR_KG = 20;
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const ROUNDING_KG = 2.5;

export interface PlateLoad {
  /** Plates on ONE side of the bar, heaviest first. */
  perSide: number[];
  /** Weight that can't be made with the plates above (kg, for the whole bar) - 0 when the load is exact. */
  leftoverKg: number;
}

/** Which plates go on each side of the bar for a total barbell weight (bar included). Heaviest plates first. */
export function getPlatesPerSide(totalKg: number, barKg: number = BAR_KG): PlateLoad {
  let remaining = Math.max((totalKg - barKg) / 2, 0);
  const perSide: number[] = [];
  for (const plate of PLATES_KG) {
    while (remaining + 1e-9 >= plate) {
      perSide.push(plate);
      remaining -= plate;
    }
  }
  return { perSide, leftoverKg: Math.round(remaining * 2 * 100) / 100 };
}

export interface WarmupSet {
  weightKg: number;
  reps: number;
}

const roundToPlate = (kg: number) => Math.round(kg / ROUNDING_KG) * ROUNDING_KG;

/**
 * A short ramp to the working weight: the empty bar for 10, then about 50% x 5, 70% x 3 and 85% x 1. Weights are rounded to 2.5 kg, must
 * be heavier than the step before, and stay below the working weight. Empty for loads too light to need a warm-up (under 40 kg).
 */
export function buildWarmupSets(workingKg: number, barKg: number = BAR_KG): WarmupSet[] {
  if (!Number.isFinite(workingKg) || workingKg < 40) return [];
  const steps: WarmupSet[] = [
    { weightKg: barKg, reps: 10 },
    { weightKg: roundToPlate(workingKg * 0.5), reps: 5 },
    { weightKg: roundToPlate(workingKg * 0.7), reps: 3 },
    { weightKg: roundToPlate(workingKg * 0.85), reps: 1 },
  ];
  const result: WarmupSet[] = [];
  for (const step of steps) {
    const previous = result[result.length - 1];
    if (step.weightKg < workingKg && (!previous || step.weightKg > previous.weightKg)) result.push(step);
  }
  return result;
}
