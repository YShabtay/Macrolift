import type { FoodPer100g, ServingUnit } from '../types/fitness';
import { normalizeFoodQuery } from './foodSearch';

const PLURALS: Record<string, string> = {
  יחידה: 'יחידות',
  פרוסה: 'פרוסות',
  כף: 'כפות',
  כפית: 'כפיות',
  כוס: 'כוסות',
  גביע: 'גביעות',
  כדור: 'כדורים',
  קובייה: 'קוביות',
  קופסה: 'קופסאות',
  סקופ: 'סקופים',
  שקד: 'שקדים',
  חופן: 'חופנים',
  'אגוז שלם': 'אגוזים שלמים',
  'חצי אגוז': 'חצאי אגוז',
  'חצי אבוקדו': 'חצאי אבוקדו',
};

/** Weight of `quantity` units, rounded to 0.1 g. */
export function unitsToGrams(quantity: number, unit: ServingUnit): number {
  return Math.round(quantity * unit.grams * 10) / 10;
}

/** "1 יחידה" / "2 יחידות" - the unit name in the right number for the quantity. */
export function formatUnitCount(quantity: number, unit: ServingUnit): string {
  const name = quantity === 1 ? unit.name : (PLURALS[unit.name] ?? unit.name);
  return `${quantity} ${name}`;
}

/** The entry's quantity text for a unit-based portion, e.g. "2 יחידות (~110 גרם)". */
export function formatServingQuantity(quantity: number, unit: ServingUnit): string {
  return `${formatUnitCount(quantity, unit)} (~${unitsToGrams(quantity, unit)} גרם)`;
}

/** Foods whose usual unit is small (an egg, a date, a slice, a spoon) open in unit mode; heavy ones (a cup of rice) in grams. */
export function shouldDefaultToUnits(units: ServingUnit[] | undefined): boolean {
  return !!units && units.length > 0 && units[0].grams <= 60;
}

/** Looks a food's serving units up by exact (normalized) name, so entries logged earlier can offer units when edited. */
export function findServingUnitsByName(name: string, foods: FoodPer100g[]): ServingUnit[] | undefined {
  const target = normalizeFoodQuery(name);
  return foods.find((f) => normalizeFoodQuery(f.name) === target && f.servingUnits?.length)?.servingUnits;
}

/** Keeps only well-formed units from untrusted data (e.g. an AI answer or a stored cache entry). */
export function sanitizeServingUnits(raw: unknown): ServingUnit[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const units: ServingUnit[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { name, grams } = item as { name?: unknown; grams?: unknown };
    const g = typeof grams === 'number' ? grams : Number(grams);
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 20) continue;
    if (!Number.isFinite(g) || g < 0.5 || g > 1000) continue;
    units.push({ name: name.trim(), grams: Math.round(g * 10) / 10 });
    if (units.length === 3) break;
  }
  return units.length > 0 ? units : undefined;
}
