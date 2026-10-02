import { API_KEY, GEMINI_MODEL, MissingApiKeyError } from './aiFoodScanner';

export { MissingApiKeyError };

/** One food Gemini identified in a spoken/typed meal description - values are for the amount eaten, not per 100 g. */
export interface VoiceFoodItem {
  id: string;
  name: string;
  /** The amount as the user phrased it, e.g. "200 גרם" or "כוס". */
  amount: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const MAX_DESCRIPTION_CHARS = 800;

const SYSTEM_PROMPT = `אתה מומחה תזונה שמפענח תיאור חופשי בעברית (לרוב מדוברת) של מה שאדם אכל, עבור אפליקציית מעקב תזונה.

המשימה:
1. זהה כל פריט מזון נפרד שהוזכר.
2. אם צוינה כמות בגרמים - השתמש בה בדיוק. אם צוינה כמות במידות ביתיות (כוס, כף, יחידה, פרוסה, מנה וכד') - המר לגרמים לפי גודל מנה טיפוסי של המאכל כפי שנאכל (למשל כוס אורז מבושל ≈ 160 גרם, ביצה ≈ 55 גרם, פרוסת לחם ≈ 30 גרם). אם לא צוינה כמות כלל - הנח מנה טיפוסית.
3. חשב עבור הכמות שנאכלה בפועל (לא ל-100 גרם): קלוריות, חלבון, פחמימה ושומן, לפי ערכים תזונתיים ממוצעים של המאכל.

החזר תשובה אך ורק כמערך JSON תקין, ללא טקסט נוסף וללא Markdown:
[
  { "name": "שם המאכל בעברית, קצר", "amount": "הכמות כפי שנאמרה", "grams": מספר, "calories": מספר, "protein": מספר, "carbs": מספר, "fat": מספר }
]

כל הערכים המספריים חייבים להיות מספרים (לא מחרוזות). אם התיאור אינו מכיל שום מאכל מזוהה, החזר מערך ריק [].`;

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Turns Gemini's JSON into trusted items: drops entries that are physically impossible (no name,
 * non-positive or absurd weight, negative values, macros heavier than the food itself) and repairs
 * calories when they wildly disagree with the macros (4/4/9 kcal per gram).
 */
export function parseVoiceMealResponse(rawText: string): VoiceFoodItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('לא ניתן היה לפענח את תשובת ה-AI. נסו שוב.');
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { items?: unknown })?.items) ? (parsed as { items: unknown[] }).items : [];

  const items: VoiceFoodItem[] = [];
  for (const raw of list) {
    if (typeof raw !== 'object' || raw === null) continue;
    const o = raw as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const grams = num(o.grams);
    const protein = num(o.protein) ?? 0;
    const carbs = num(o.carbs) ?? 0;
    const fat = num(o.fat) ?? 0;
    let calories = num(o.calories);
    if (!name || grams === null || grams <= 0 || grams > 3000 || calories === null) continue;
    if (calories < 0 || protein < 0 || carbs < 0 || fat < 0) continue;
    if (protein + carbs + fat > grams * 1.05) continue;

    const fromMacros = protein * 4 + carbs * 4 + fat * 9;
    if (fromMacros > 0 && Math.abs(calories - fromMacros) > Math.max(40, fromMacros * 0.4)) calories = fromMacros;

    const round1 = (n: number) => Math.round(n * 10) / 10;
    items.push({
      id: crypto.randomUUID(),
      name,
      amount: typeof o.amount === 'string' && o.amount.trim() ? o.amount.trim() : `${Math.round(grams)} גרם`,
      grams: Math.round(grams),
      calories: Math.round(calories),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
    });
  }
  return items;
}

/** Sends a meal description to Gemini and returns the foods it identified, with estimated grams and macros. */
export async function parseMealDescription(description: string): Promise<VoiceFoodItem[]> {
  if (!API_KEY) throw new MissingApiKeyError('VITE_GEMINI_API_KEY is not configured');
  const text = description.trim().slice(0, MAX_DESCRIPTION_CHARS);
  if (text.length < 2) throw new Error('לא התקבל תיאור. נסו שוב וספרו מה אכלתם.');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `מה שאכלתי: ${text}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );
  if (!response.ok) throw new Error(`הניתוח נכשל (${response.status}). נסו שוב.`);

  const data = await response.json();
  const out: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error('לא התקבלה תשובה מה-AI');

  const items = parseVoiceMealResponse(out);
  if (items.length === 0) throw new Error('לא זוהו מאכלים בתיאור. נסו לנסח למשל: "אכלתי 200 גרם חזה עוף וכוס אורז".');
  return items;
}
