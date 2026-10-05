import { describe, expect, it } from 'vitest';
import { getProductTitle, normalizeBarcode, parseOpenFoodFactsProduct, validateManualBarcodeFood } from './barcodeLookup';

describe('normalizeBarcode', () => {
  it('keeps digits and accepts real barcode lengths only', () => {
    expect(normalizeBarcode('7290 0041 31074')).toBe('7290004131074');
    expect(normalizeBarcode('12345678')).toBe('12345678');
    expect(normalizeBarcode('123456')).toBeNull();
    expect(normalizeBarcode('abc')).toBeNull();
  });
});

describe('getProductTitle', () => {
  it('prefers the Hebrew name and appends brand and pack size so variants can be told apart', () => {
    expect(getProductTitle({ product_name_he: 'יוגורט וניל', product_name: 'Vanilla yogurt', brands: 'דנונה, Danone', quantity: '200 g' })).toBe('יוגורט וניל - דנונה (200 g)');
  });

  it("doesn't repeat a brand or size that is already in the name", () => {
    expect(getProductTitle({ product_name: 'Danone Pro 200 g', brands: 'Danone', quantity: '200 g' })).toBe('Danone Pro 200 g');
  });

  it('is null when the product has no name at all', () => {
    expect(getProductTitle({ brands: 'Danone' })).toBeNull();
  });
});

describe('parseOpenFoodFactsProduct', () => {
  const per100 = { 'energy-kcal_100g': 90, proteins_100g: 10, carbohydrates_100g: 9, fat_100g: 1.5 };

  it('reads per-100 g values', () => {
    const food = parseOpenFoodFactsProduct('7290000000001', { product_name: 'x', nutriments: per100 });
    expect(food).toMatchObject({ id: 'barcode-7290000000001', calories: 90, protein: 10, carbs: 9, fat: 1.5 });
  });

  it('converts kJ to kcal when only kJ is given', () => {
    const food = parseOpenFoodFactsProduct('7290000000001', { product_name: 'x', nutriments: { 'energy-kj_100g': 418.4, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } });
    expect(food?.calories).toBe(100);
  });

  it('falls back to per-serving values using the serving size (a 200 g pot with 50 g of protein per serving = 25 g per 100 g)', () => {
    const food = parseOpenFoodFactsProduct('7290000000001', {
      product_name: 'Pro',
      serving_quantity: 200,
      nutriments: { 'energy-kcal_serving': 180, proteins_serving: 50, carbohydrates_serving: 18, fat_serving: 3 },
    });
    expect(food).toMatchObject({ calories: 90, protein: 25, carbs: 9, fat: 1.5 });
  });

  it('rejects products that are missing a macro, instead of logging wrong numbers', () => {
    expect(parseOpenFoodFactsProduct('7290000000001', { product_name: 'x', nutriments: { 'energy-kcal_100g': 90, proteins_100g: 10 } })).toBeNull();
    expect(parseOpenFoodFactsProduct('7290000000001', { product_name: 'x', nutriments: {} })).toBeNull();
  });

  it('rejects impossible values', () => {
    expect(parseOpenFoodFactsProduct('7290000000001', { product_name: 'x', nutriments: { ...per100, 'energy-kcal_100g': 1200 } })).toBeNull();
    expect(parseOpenFoodFactsProduct('7290000000001', { product_name: 'x', nutriments: { ...per100, proteins_100g: 80, carbohydrates_100g: 40 } })).toBeNull();
  });
});

describe('validateManualBarcodeFood', () => {
  const ok = { name: 'דנונה פרו וניל', calories: 90, protein: 10, carbs: 9, fat: 1.5 };

  it('accepts plausible values from a package', () => {
    expect(validateManualBarcodeFood(ok)).toBeNull();
  });

  it('asks for a name and real numbers', () => {
    expect(validateManualBarcodeFood({ ...ok, name: '  ' })).toBeTruthy();
    expect(validateManualBarcodeFood({ ...ok, protein: Number.NaN })).toBeTruthy();
    expect(validateManualBarcodeFood({ ...ok, fat: -1 })).toBeTruthy();
  });

  it("refuses values that can't be per 100 g", () => {
    expect(validateManualBarcodeFood({ ...ok, calories: 950 })).toBeTruthy();
    expect(validateManualBarcodeFood({ ...ok, protein: 60, carbs: 50 })).toBeTruthy();
  });
});
