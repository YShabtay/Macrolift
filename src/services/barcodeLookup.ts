import type { FoodPer100g, ServingUnit } from '../types/fitness';
import { storageService } from './storageService';

const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,product_name_he,generic_name,brands,nutriments,serving_quantity,product_quantity';
const REQUEST_TIMEOUT_MS = 10_000;

export class ProductNotFoundError extends Error {
  constructor() {
    super('המוצר לא נמצא במאגר הברקודים');
    this.name = 'ProductNotFoundError';
  }
}

/** Keeps digits only and accepts the lengths real product barcodes have (EAN-8, UPC-A, EAN-13, GTIN-14). Null otherwise. */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return [8, 12, 13, 14].includes(digits.length) ? digits : null;
}

const num = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Turns an Open Food Facts product into the app's per-100 g food. Calories come from kcal, or from kJ when only that is given; values that
 * are impossible (negative, over 900 kcal, macros over 100 g) or missing the basics make the product unusable, so nothing wrong reaches the log.
 */
export function parseOpenFoodFactsProduct(code: string, product: Record<string, unknown>): FoodPer100g | null {
  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  const kcal = num(nutriments['energy-kcal_100g']) ?? (num(nutriments['energy-kj_100g']) ?? num(nutriments['energy_100g']) ?? NaN) / 4.184;
  const protein = num(nutriments.proteins_100g);
  const carbs = num(nutriments.carbohydrates_100g);
  const fat = num(nutriments.fat_100g);
  if (!Number.isFinite(kcal) || protein === null || carbs === null || fat === null) return null;
  if ([kcal, protein, carbs, fat].some((n) => n < 0) || kcal > 900 || protein + carbs + fat > 100.5) return null;

  const title = [product.product_name_he, product.product_name, product.generic_name].find((v): v is string => typeof v === 'string' && v.trim().length > 0)?.trim();
  const brand = typeof product.brands === 'string' ? product.brands.split(',')[0].trim() : '';
  if (!title) return null;

  const servingUnits: ServingUnit[] = [];
  const serving = num(product.serving_quantity);
  if (serving !== null && serving >= 1 && serving <= 1000) servingUnits.push({ name: 'מנה', grams: round1(serving) });
  const pack = num(product.product_quantity);
  if (pack !== null && pack >= 5 && pack <= 5000 && pack !== serving) servingUnits.push({ name: 'אריזה', grams: round1(pack) });

  return {
    id: `barcode-${code}`,
    name: brand && !title.toLowerCase().includes(brand.toLowerCase()) ? `${title} - ${brand}` : title,
    calories: Math.round(kcal),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    servingUnit: 'גרם',
    ...(servingUnits.length > 0 ? { servingUnits } : {}),
    aliases: [code],
  };
}

/**
 * Looks a barcode up in Open Food Facts and caches the product on the device, so the same product is found by name, or by scanning, later
 * without a network. Throws ProductNotFoundError when the database has no usable entry.
 */
export async function lookupBarcode(rawCode: string): Promise<FoodPer100g> {
  const code = normalizeBarcode(rawCode);
  if (!code) throw new Error('הברקוד אינו תקין');

  const cached = (await storageService.getCustomFoods()).find((f) => f.id === `barcode-${code}`);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${OPEN_FOOD_FACTS_URL}/${code}.json?fields=${FIELDS}`, { signal: controller.signal });
  } catch {
    throw new Error('אין חיבור לאינטרנט, או שהשרת לא הגיב. נסו שוב.');
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 404) throw new ProductNotFoundError();
  if (!response.ok) throw new Error('החיפוש במאגר הברקודים נכשל. נסו שוב.');

  const data = (await response.json()) as { status?: number; product?: Record<string, unknown> };
  const food = data.status === 1 && data.product ? parseOpenFoodFactsProduct(code, data.product) : null;
  if (!food) throw new ProductNotFoundError();

  const current = await storageService.getCustomFoods();
  await storageService.saveCustomFoods([food, ...current.filter((f) => f.id !== food.id)]);
  return food;
}
