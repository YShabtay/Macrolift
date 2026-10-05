import type { FoodPer100g, ServingUnit } from '../types/fitness';
import { storageService } from './storageService';

const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,product_name_he,generic_name,brands,nutriments,serving_quantity,product_quantity,quantity';
const REQUEST_TIMEOUT_MS = 10_000;

export class ProductNotFoundError extends Error {
  constructor() {
    super('המוצר לא נמצא במאגר הברקודים');
    this.name = 'ProductNotFoundError';
  }
}

/** The product exists in the database, but without nutrition values the app can trust - the user can type them in from the package. */
export class ProductWithoutNutritionError extends Error {
  readonly code: string;
  readonly productName: string;

  constructor(code: string, productName: string) {
    super('נמצא מוצר במאגר, אבל חסרים בו ערכי תזונה');
    this.name = 'ProductWithoutNutritionError';
    this.code = code;
    this.productName = productName;
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

/** The product's display name: Hebrew name first, then the generic one, with the brand and pack size so the user can tell variants apart. */
export function getProductTitle(product: Record<string, unknown>): string | null {
  const title = [product.product_name_he, product.product_name, product.generic_name].find((v): v is string => typeof v === 'string' && v.trim().length > 0)?.trim();
  if (!title) return null;
  const brand = typeof product.brands === 'string' ? product.brands.split(',')[0].trim() : '';
  const size = typeof product.quantity === 'string' ? product.quantity.trim() : '';
  const withBrand = brand && !title.toLowerCase().includes(brand.toLowerCase()) ? `${title} - ${brand}` : title;
  return size && !withBrand.includes(size) ? `${withBrand} (${size})` : withBrand;
}

/**
 * Per-100 g values: taken as given, or - when the database only has them per serving - converted using the serving size.
 * Null when neither is complete.
 */
function readNutrition(product: Record<string, unknown>): { kcal: number; protein: number; carbs: number; fat: number } | null {
  const n = (product.nutriments ?? {}) as Record<string, unknown>;
  const kcal100 = num(n['energy-kcal_100g']) ?? (num(n['energy-kj_100g']) ?? num(n['energy_100g']) ?? NaN) / 4.184;
  const protein100 = num(n.proteins_100g);
  const carbs100 = num(n.carbohydrates_100g);
  const fat100 = num(n.fat_100g);
  if (Number.isFinite(kcal100) && protein100 !== null && carbs100 !== null && fat100 !== null) {
    return { kcal: kcal100, protein: protein100, carbs: carbs100, fat: fat100 };
  }

  const serving = num(product.serving_quantity);
  if (serving === null || serving < 1 || serving > 1000) return null;
  const factor = 100 / serving;
  const kcalServing = num(n['energy-kcal_serving']) ?? (num(n['energy-kj_serving']) ?? NaN) / 4.184;
  const proteinServing = num(n.proteins_serving);
  const carbsServing = num(n.carbohydrates_serving);
  const fatServing = num(n.fat_serving);
  if (!Number.isFinite(kcalServing) || proteinServing === null || carbsServing === null || fatServing === null) return null;
  return { kcal: kcalServing * factor, protein: proteinServing * factor, carbs: carbsServing * factor, fat: fatServing * factor };
}

/**
 * Turns an Open Food Facts product into the app's per-100 g food. Calories come from kcal, or from kJ when only that is given; values that
 * are impossible (negative, over 900 kcal, macros over 100 g) or missing the basics make the product unusable, so nothing wrong reaches the log.
 */
export function parseOpenFoodFactsProduct(code: string, product: Record<string, unknown>): FoodPer100g | null {
  const nutrition = readNutrition(product);
  if (!nutrition) return null;
  const { kcal, protein, carbs, fat } = nutrition;
  if ([kcal, protein, carbs, fat].some((n) => n < 0) || kcal > 900 || protein + carbs + fat > 100.5) return null;

  const title = getProductTitle(product);
  if (!title) return null;

  const servingUnits: ServingUnit[] = [];
  const serving = num(product.serving_quantity);
  if (serving !== null && serving >= 1 && serving <= 1000) servingUnits.push({ name: 'מנה', grams: round1(serving) });
  const pack = num(product.product_quantity);
  if (pack !== null && pack >= 5 && pack <= 5000 && pack !== serving) servingUnits.push({ name: 'אריזה', grams: round1(pack) });

  return {
    id: `barcode-${code}`,
    name: title,
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
  if (!food) {
    // The product is in the database but its values are missing or unusable: say so, so the values can be typed in from the package.
    const name = data.status === 1 && data.product ? getProductTitle(data.product) : null;
    throw name ? new ProductWithoutNutritionError(code, name) : new ProductNotFoundError();
  }

  const current = await storageService.getCustomFoods();
  await storageService.saveCustomFoods([food, ...current.filter((f) => f.id !== food.id)]);
  return food;
}

export interface ManualBarcodeFood {
  name: string;
  /** All per 100 g, as printed on the package. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Why typed-in per-100 g values can't be right, or null when they are plausible. */
export function validateManualBarcodeFood(food: ManualBarcodeFood): string | null {
  if (!food.name.trim()) return 'חסר שם למוצר';
  const values = [food.calories, food.protein, food.carbs, food.fat];
  if (values.some((v) => !Number.isFinite(v) || v < 0)) return 'יש להזין מספרים תקינים';
  if (food.calories > 900) return 'קלוריות ל-100 גרם לא יכולות לעלות על 900';
  if (food.protein + food.carbs + food.fat > 100.5) return 'סך החלבון, הפחמימה והשומן ל-100 גרם לא יכול לעלות על 100';
  return null;
}

/** Saves values typed in from the package under the product's barcode, so scanning it again finds them straight away on this device. */
export async function saveManualBarcodeFood(rawCode: string, food: ManualBarcodeFood): Promise<FoodPer100g> {
  const code = normalizeBarcode(rawCode);
  if (!code) throw new Error('הברקוד אינו תקין');
  const saved: FoodPer100g = {
    id: `barcode-${code}`,
    name: food.name.trim(),
    calories: Math.round(food.calories),
    protein: round1(food.protein),
    carbs: round1(food.carbs),
    fat: round1(food.fat),
    servingUnit: 'גרם',
    aliases: [code],
  };
  const current = await storageService.getCustomFoods();
  await storageService.saveCustomFoods([saved, ...current.filter((f) => f.id !== saved.id)]);
  return saved;
}
