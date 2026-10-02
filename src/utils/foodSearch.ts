import type { FoodPer100g } from '../types/fitness';

/** Lowercases and strips punctuation/geresh/spacing noise so "קוטג'" and "קוטג׳ " match the same way. */
export function normalizeFoodQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[׳'"`״.,()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches foods by name/aliases. Every word the user typed must appear somewhere in the name, so
 * "חזה עוף" finds "חזה עוף מבושל" regardless of word order; names that start with the query rank first.
 */
export function searchFoods(query: string, foods: FoodPer100g[], limit = 12): FoodPer100g[] {
  const q = normalizeFoodQuery(query);
  if (q.length < 1) return [];
  const words = q.split(' ');

  const scored: { food: FoodPer100g; score: number }[] = [];
  for (const food of foods) {
    const haystacks = [food.name, ...(food.aliases ?? [])].map(normalizeFoodQuery);
    let best = -1;
    for (const h of haystacks) {
      if (!words.every((w) => h.includes(w))) continue;
      const score = h === q ? 3 : h.startsWith(q) ? 2 : 1;
      if (score > best) best = score;
    }
    if (best > 0) scored.push({ food, score: best });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
    .slice(0, limit)
    .map((s) => s.food);
}

export interface ScaledNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Scales per-100g values to an arbitrary gram amount (calories rounded to whole kcal, macros to 0.1g). */
export function scaleNutrition(food: FoodPer100g, grams: number): ScaledNutrition {
  const factor = Math.max(grams, 0) / 100;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    calories: Math.round(food.calories * factor),
    protein: round1(food.protein * factor),
    carbs: round1(food.carbs * factor),
    fat: round1(food.fat * factor),
  };
}
