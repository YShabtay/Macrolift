// gemini-2.5-flash returns 404 on generateContent for accounts without prior usage of the
// 2.x series (Google is restricting access to it) - gemini-3.5-flash-lite is multimodal
// (supports image input) and is the current default Google recommends for new projects.
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

export interface FoodScanBreakdownItem {
  item: string;
  amount: string;
  protein: number;
  calories: number;
}

export interface FoodScanResult {
  foodName: string;
  estimatedWeightGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidence: 'low' | 'medium' | 'high';
  breakdown: FoodScanBreakdownItem[];
}

/** Thrown when VITE_GEMINI_API_KEY isn't configured, so callers can show a dedicated notice. */
export class MissingApiKeyError extends Error {}

const SYSTEM_PROMPT = `אתה מומחה תזונה שמנתח תמונות של מנות אוכל עבור אפליקציית כושר ותזונה. בהינתן תמונה של צלחת/מנה, זהה את כל המרכיבים הנראים לעין, העריך את המשקל הכולל בגרמים ואת הערכים התזונתיים (קלוריות, חלבון, פחמימה, שומן) עבור המנה כולה, וגם פירוט משוער לכל מרכיב בנפרד.

החזר תשובה אך ורק כאובייקט JSON תקין בפורמט הבא, ללא כל טקסט נוסף, ללא Markdown, ללא הסברים לפני או אחרי:
{
  "foodName": "תיאור קצר וברור של המנה בעברית",
  "estimatedWeightGrams": מספר,
  "calories": מספר,
  "protein": מספר (גרם),
  "carbs": מספר (גרם),
  "fats": מספר (גרם),
  "confidence": "low" | "medium" | "high",
  "breakdown": [
    {"item": "שם המרכיב בעברית", "amount": "כמות משוערת, למשל 150g", "protein": מספר, "calories": מספר}
  ]
}

כל הערכים המספריים חייבים להיות מספרים (לא מחרוזות עם יחידות). אם קשה לזהות בבירור את תוכן התמונה, החזר confidence: "low" יחד עם ההערכה הכי טובה שאתה יכול לתת - לעולם אל תסרב לענות ואל תחזיר שדות ריקים.`;

/** Reads a File as a data URL and splits it into raw base64 + MIME type, ready for Gemini's inlineData. */
export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mimeMatch = header.match(/data:(.*);base64/);
      if (!base64) {
        reject(new Error('קריאת התמונה נכשלה'));
        return;
      }
      resolve({ base64, mimeType: mimeMatch?.[1] || file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(reader.error ?? new Error('קריאת התמונה נכשלה'));
    reader.readAsDataURL(file);
  });
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseScanResponse(rawText: string): FoodScanResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('לא ניתן היה לפענח את תשובת ה-AI');
  }

  const obj = (parsed ?? {}) as Record<string, unknown>;
  const confidence = obj.confidence === 'high' || obj.confidence === 'low' ? obj.confidence : 'medium';
  const breakdown: FoodScanBreakdownItem[] = Array.isArray(obj.breakdown)
    ? obj.breakdown.map((raw) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        return {
          item: typeof item.item === 'string' ? item.item : '',
          amount: typeof item.amount === 'string' ? item.amount : '',
          protein: toNumber(item.protein),
          calories: toNumber(item.calories),
        };
      })
    : [];

  return {
    foodName: typeof obj.foodName === 'string' && obj.foodName.trim() ? obj.foodName : 'מנה לא מזוהה',
    estimatedWeightGrams: toNumber(obj.estimatedWeightGrams),
    calories: toNumber(obj.calories),
    protein: toNumber(obj.protein),
    carbs: toNumber(obj.carbs),
    fats: toNumber(obj.fats),
    confidence,
    breakdown,
  };
}

/** Sends a meal photo (base64) to Gemini's vision model and returns the parsed nutrition estimate. */
export async function scanMealImage(base64Image: string, mimeType: string): Promise<FoodScanResult> {
  if (!API_KEY) throw new MissingApiKeyError('VITE_GEMINI_API_KEY is not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'נתחו את המנה בתמונה הבאה והחזירו JSON בפורמט שהוגדר בהוראות המערכת.' },
              { inlineData: { mimeType, data: base64Image } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) throw new Error(`בקשת הניתוח נכשלה (${response.status})`);

  const data = await response.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('לא התקבלה תשובה מה-AI');

  return parseScanResponse(text);
}
