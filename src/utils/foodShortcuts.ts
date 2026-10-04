import type { FavoriteFood, FoodEntry, FoodTemplate, Meal, SavedMeal } from '../types/fitness';

const MAX_FAVORITES = 60;
const MAX_SAVED_MEALS = 30;

/** The reusable part of a logged entry (what it was and how much), without when / which meal it was eaten. */
export function toFoodTemplate(entry: FoodEntry | FoodTemplate): FoodTemplate {
  return {
    name: entry.name,
    quantity: entry.quantity,
    ...(entry.weightGrams !== undefined ? { weightGrams: entry.weightGrams } : {}),
    ...(entry.unitLabel ? { unitLabel: entry.unitLabel } : {}),
    calories: entry.calories,
    proteinG: entry.proteinG,
    fatG: entry.fatG,
    carbsG: entry.carbsG,
  };
}

/** Two entries are "the same food" when name and portion match. */
export function foodKey(food: Pick<FoodTemplate, 'name' | 'quantity'>): string {
  return `${food.name.trim().toLowerCase()}|${food.quantity.trim().toLowerCase()}`;
}

/** A new entry for `date` / `meal` from a saved template (the app adds id and time when it stores it). */
export function templateToEntry(template: FoodTemplate, date: string, meal: Meal): Omit<FoodEntry, 'id'> {
  return { ...toFoodTemplate(template), date, meal };
}

/** The distinct foods logged most recently (same name and portion counted once), newest first. */
export function getRecentFoods(foodLog: FoodEntry[], limit = 10): FoodTemplate[] {
  const sorted = [...foodLog].sort((a, b) => (a.date === b.date ? (b.time ?? '').localeCompare(a.time ?? '') : b.date.localeCompare(a.date)));
  const seen = new Set<string>();
  const recents: FoodTemplate[] = [];
  for (const entry of sorted) {
    const key = foodKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    recents.push(toFoodTemplate(entry));
    if (recents.length >= limit) break;
  }
  return recents;
}

export function findFavorite(favorites: FavoriteFood[], food: Pick<FoodTemplate, 'name' | 'quantity'>): FavoriteFood | undefined {
  const key = foodKey(food);
  return favorites.find((f) => foodKey(f) === key);
}

/** Adds the food to the favorites, or removes it when it's already there. */
export function toggleFavoriteFood(favorites: FavoriteFood[], entry: FoodEntry | FoodTemplate): FavoriteFood[] {
  const existing = findFavorite(favorites, entry);
  if (existing) return favorites.filter((f) => f.id !== existing.id);
  const created: FavoriteFood = { ...toFoodTemplate(entry), id: crypto.randomUUID() };
  return [created, ...favorites].slice(0, MAX_FAVORITES);
}

/** Saves a meal's entries under a name. Returns the list unchanged when there's nothing to save. */
export function addSavedMeal(saved: SavedMeal[], name: string, entries: (FoodEntry | FoodTemplate)[]): SavedMeal[] {
  const cleanName = name.trim().slice(0, 40);
  if (!cleanName || entries.length === 0) return saved;
  return [{ id: crypto.randomUUID(), name: cleanName, items: entries.map(toFoodTemplate) }, ...saved].slice(0, MAX_SAVED_MEALS);
}

/** The same meal as eaten on another date, ready to be added to `toDate`. */
export function copyMealEntries(foodLog: FoodEntry[], fromDate: string, toDate: string, meal: Meal): Omit<FoodEntry, 'id'>[] {
  return foodLog.filter((f) => f.date === fromDate && f.meal === meal).map((f) => templateToEntry(f, toDate, meal));
}

export function sumTemplates(items: FoodTemplate[]): { calories: number; proteinG: number } {
  return items.reduce((acc, i) => ({ calories: acc.calories + i.calories, proteinG: acc.proteinG + i.proteinG }), { calories: 0, proteinG: 0 });
}
