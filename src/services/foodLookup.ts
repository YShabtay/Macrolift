import type { FoodPer100g } from '../types/fitness';
import { API_KEY, GEMINI_MODEL, MissingApiKeyError } from './aiFoodScanner';
import { storageService } from './storageService';
import { normalizeFoodQuery } from '../utils/foodSearch';
import { sanitizeServingUnits } from '../utils/servingUnits';

export { MissingApiKeyError };

const SYSTEM_PROMPT = `אתה מאגר נתונים תזונתי. בהינתן שם של מאכל או מוצר (בכל שפה), החזר את הערכים התזונתיים הממוצעים והמקובלים עבור 100 גרם של אותו מאכל כפי שהוא נאכל בדרך כלל (אם מדובר במאכל שמבשלים - הערכים למוצר מבושל, אלא אם צוין אחרת).

החזר תשובה אך ורק כאובייקט JSON תקין בפורמט הבא, ללא טקסט נוסף וללא Markdown:
{
  "name": "שם המאכל בעברית, קצר וברור",
  "calories": מספר (קלוריות ל-100 גרם),
  "protein": מספר (גרם חלבון ל-100 גרם),
  "carbs": מספר (גרם פחמימה ל-100 גרם),
  "fat": מספר (גרם שומן ל-100 גרם),
  "servingUnits": [ { "name": "יחידת מידה טבעית בעברית (למשל: יחידה, פרוסה, כף, כוס)", "grams": מספר (משקל ממוצע מקובל של יחידה אחת בגרמים) } ]
}

servingUnits הוא שדה אופציונלי: עד 3 יחידות מידה שבהן אנשים נוהגים לספור את המאכל הזה, עם המשקל הממוצע המקובל של כל אחת (למשל ביצה = 55 גרם, כף שמן = 15 גרם). אם אין יחידה טבעית למאכל, השמט את השדה.

כל הערכים המספריים חייבים להיות מספרים (לא מחרוזות). אם הקלט אינו מאכל או מוצר מזון מזוהה, החזר {"error": "not_food"}.`;

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function slugify(text: string): string {
  return normalizeFoodQuery(text).replace(/\s+/g, '-');
}

/** Rejects physically impossible values so a hallucinated answer never reaches the user's log or cache. */
function parseFoodResponse(rawText: string, query: string): FoodPer100g {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('לא ניתן היה לפענח את תשובת ה-AI');
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  if (obj.error === 'not_food') throw new Error('לא זוהה מאכל - נסו ניסוח אחר');

  const calories = toNumber(obj.calories);
  const protein = toNumber(obj.protein);
  const carbs = toNumber(obj.carbs);
  const fat = toNumber(obj.fat);
  if (calories === null || protein === null || carbs === null || fat === null) {
    throw new Error('ה-AI לא החזיר ערכים תזונתיים מלאים');
  }
  const macroSum = protein + carbs + fat;
  if (
    [calories, protein, carbs, fat].some((n) => n < 0) ||
    calories > 900 ||
    macroSum > 100.5 ||
    // Calories must be roughly explained by the macros (4/4/9 kcal per gram) - catches swapped or invented numbers.
    Math.abs(calories - (protein * 4 + carbs * 4 + fat * 9)) > Math.max(60, calories * 0.4)
  ) {
    throw new Error('הערכים שהתקבלו אינם הגיוניים - נסו שוב או הזינו ידנית');
  }

  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : query.trim();
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    id: `ai-${slugify(name) || slugify(query)}`,
    name,
    calories: Math.round(calories),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    servingUnit: 'גרם',
    servingUnits: sanitizeServingUnits(obj.servingUnits),
    aliases: normalizeFoodQuery(query) !== normalizeFoodQuery(name) ? [query.trim()] : undefined,
    fromAI: true,
  };
}

/** Asks Gemini for a food's average nutrition per 100 g. Does not touch the cache - see lookupAndCacheFood. */
export async function lookupFoodWithAI(query: string): Promise<FoodPer100g> {
  if (!API_KEY) throw new MissingApiKeyError('VITE_GEMINI_API_KEY is not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `המאכל: ${query.trim()}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );
  if (!response.ok) throw new Error(`החיפוש עם AI נכשל (${response.status})`);

  const data = await response.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('לא התקבלה תשובה מה-AI');
  return parseFoodResponse(text, query);
}

/**
 * Looks a food up with AI and immediately persists it on the device, so the next search finds it
 * locally with no network call. Replaces an earlier cached entry with the same id.
 */
export async function lookupAndCacheFood(query: string): Promise<FoodPer100g> {
  const food = await lookupFoodWithAI(query);
  const existing = await storageService.getCustomFoods();
  const merged = [food, ...existing.filter((f) => f.id !== food.id)];
  try {
    await storageService.saveCustomFoods(merged);
  } catch {
    // Cache write failed (e.g. storage full) - the lookup itself still succeeded, so still return it.
  }
  return food;
}
