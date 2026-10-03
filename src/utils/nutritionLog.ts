import type { FoodEntry, MacroGrams, Meal } from '../types/fitness';

export interface DailyTotals {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'בוקר',
  lunch: 'צהריים',
  dinner: 'ערב',
  snacks: 'נשנושים',
};

/** Best-guess meal bucket for the current local time, used where there's no explicit meal picker (e.g. quick-add from chat). */
export function getMealForCurrentTime(): Meal {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
}

export function getEntriesForDate(foodLog: FoodEntry[], date: string): FoodEntry[] {
  return foodLog.filter((f) => f.date === date);
}

export function sumTotals(entries: FoodEntry[]): DailyTotals {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      fatG: acc.fatG + e.fatG,
      carbsG: acc.carbsG + e.carbsG,
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  );
}

/** What an entry is called in lists: the natural amount the user said ("3 ביצים") when known, otherwise the food name. */
export function getEntryTitle(entry: FoodEntry): string {
  return entry.unitLabel ?? entry.name;
}

const WEIGHT_OR_VOLUME_AMOUNT = /גרם|גר[׳'’]|ג[׳'’]|ק״ג|קילו|מ״ל|מיליליטר|ליטר|\bg\b|\bml\b/i;

/** Natural-unit amounts start with a count and are not a plain weight/volume: "3 ביצים", "2 פרוסות לחם" (not "200 גרם"). */
export function toUnitLabel(amount: string): string | undefined {
  const text = amount.trim();
  if (text.length === 0 || text.length > 40) return undefined;
  if (!/^\d+(\.\d+)?\s*\S/.test(text) || WEIGHT_OR_VOLUME_AMOUNT.test(text)) return undefined;
  return text;
}

export function calculateRemaining(
  targetCalories: number,
  targetMacros: MacroGrams,
  eaten: DailyTotals,
): DailyTotals {
  return {
    calories: Math.round(targetCalories - eaten.calories),
    proteinG: Math.round(targetMacros.proteinG - eaten.proteinG),
    fatG: Math.round(targetMacros.fatG - eaten.fatG),
    carbsG: Math.round(targetMacros.carbsG - eaten.carbsG),
  };
}
