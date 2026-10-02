import type { AppState, Goal, GoalIntensity } from '../types/fitness';
import { buildCoachSystemPrompt } from '../utils/aiContext';

// gemini-2.5-flash returns 404 on generateContent for accounts without prior usage of the
// 2.x series (Google is restricting access to it) - gemini-3.5-flash-lite is the current
// fast/cost-effective default Google recommends for new projects as of September 2026.
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

/** Whether VITE_GEMINI_API_KEY is configured, so the UI can show the "connect your key" notice up front. */
export const hasGeminiApiKey = Boolean(API_KEY);

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

/** A single image ready for Gemini's `inlineData` part: raw base64 (no `data:` prefix) plus its MIME type. */
export interface ImagePart {
  base64: string;
  mimeType: string;
}

/** Thrown when VITE_GEMINI_API_KEY isn't configured, so callers can show a dedicated "connect your key" notice. */
export class MissingApiKeyError extends Error {}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/** Shared request/error-handling for every Gemini call in this service. */
async function callGemini(systemInstruction: string, contents: GeminiContent[], asJson: boolean): Promise<string> {
  if (!API_KEY) throw new MissingApiKeyError('VITE_GEMINI_API_KEY is not configured');

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          ...(asJson ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
        }),
      },
    );
  } catch {
    throw new Error('לא ניתן להתחבר לשרת ה-AI כרגע. בדקו את החיבור לאינטרנט ונסו שוב.');
  }

  if (!response.ok) throw new Error(`הבקשה נכשלה (${response.status}). נסו שוב בעוד רגע.`);

  const data = await response.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('לא התקבלה תשובה מה-AI. נסו שוב בעוד רגע.');

  return text;
}

/**
 * Sends the running conversation to Gemini with a system instruction built from the
 * user's live MacroLift profile (weight, height, age, steps, nutrition target, macros,
 * active workout plan), and returns the coach's reply text.
 */
export async function sendCoachMessage(history: ChatMessage[], appState: AppState): Promise<string> {
  const systemInstruction = buildCoachSystemPrompt(appState);
  const contents: GeminiContent[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  return callGemini(systemInstruction, contents, false);
}

// ---------------------------------------------------------------------------
// Progress-photo AI review (Body Progress AI Review)
// ---------------------------------------------------------------------------

const GOAL_LABELS: Record<Goal, string> = {
  lose_weight: 'ירידה במשקל',
  maintain: 'שמירה על המשקל',
  gain_muscle: 'מסה מבוקרת (Lean Bulk)',
  recomp: 'שיפור הרכב גוף (Recomp)',
};

export interface ProgressReviewContext {
  goal: Goal;
  goalIntensity?: GoalIntensity;
  beforeDate: string;
  afterDate: string;
  daysBetween: number;
  beforeWeightKg?: number;
  afterWeightKg?: number;
  /** Latest calendar week's average weight change vs. the week before it, when available. */
  weeklyTrendDeltaKg?: number | null;
}

export type MuscleMassTrend = 'increase' | 'stable' | 'decrease';

export interface ProgressReviewResult {
  visualAssessment: string;
  /** A rough visual estimate range (e.g. "16%-18%"), never a fake-precise single number - photos alone can't measure this. */
  bodyFatEstimateRange: string;
  muscleMassTrend: MuscleMassTrend;
  /** Short qualitative note on visible muscle fullness/definition change - actual mass in kg can't be derived from photos. */
  muscleMassNote: string;
  isPlateaued: boolean;
  recommendationTitle: string;
  recommendationText: string;
  /** Signed kcal/day delta to apply to the daily target - only set when the recommendation is a calorie change. */
  calorieAdjustment?: number;
}

function buildProgressReviewPrompt(context: ProgressReviewContext): string {
  const weightLine =
    context.beforeWeightKg !== undefined && context.afterWeightKg !== undefined
      ? `משקל בתמונה הראשונה: ${context.beforeWeightKg} ק"ג, משקל בתמונה השנייה: ${context.afterWeightKg} ק"ג (שינוי: ${Math.round((context.afterWeightKg - context.beforeWeightKg) * 10) / 10} ק"ג)`
      : 'אין נתוני משקל מדויקים לשתי התמונות';

  const trendLine =
    context.weeklyTrendDeltaKg !== null && context.weeklyTrendDeltaKg !== undefined
      ? `מגמת השבוע האחרון לעומת השבוע שלפניו: ${context.weeklyTrendDeltaKg > 0 ? '+' : ''}${context.weeklyTrendDeltaKg} ק"ג`
      : 'אין עדיין מספיק נתוני שקילה למגמה שבועית';

  return `אתה מאמן כושר ותזונה מקצועי שמנתח שתי תמונות התקדמות גוף (לפני/אחרי) עבור מתאמן באפליקציית MacroLift. ענה תמיד בעברית, בטון מקצועי ותומך.

## נתוני המתאמן
- מטרה: ${GOAL_LABELS[context.goal]}${context.goalIntensity ? ` (עצימות: ${context.goalIntensity === 'aggressive' ? 'אגרסיבית' : 'מתונה'})` : ''}
- מרווח בין התמונות: ${context.daysBetween} ימים
- ${weightLine}
- ${trendLine}

## המשימה שלך
1. השווה ויזואלית בין שתי התמונות: שינוי בחיטוב, מסת שריר נראית לעין, אזורי שומן עיקריים. היה כן וענייני, לא מחמיא סתם.
2. תן הערכה חזותית גסה (טווח, לא מספר מדויק) לאחוז השומן הנראה בתמונה העדכנית - זו הערכה ויזואלית בלבד, לא מדידה מדעית (אין קליפרים/DEXA), ויש לנסח אותה כטווח כן, למשל "כ-16%-18%". אם איכות או זווית התמונות לא מאפשרות הערכה סבירה, החזירו "לא ניתן להעריך מהתמונות" ואל תמציאו מספר.
3. קבעו מגמת מסת שריר נראית לעין (עלייה/יציבות/ירידה בנפח ובהגדרה השרירית) - שוב, הערכה ויזואלית של נפח/הגדרה, לא משקל שריר בק"ג שאי אפשר לגזור מתמונה.
4. קבע האם יש עצירה אמיתית בהתקדמות (Plateau) - שילוב של חוסר שינוי ויזואלי משמעותי + נתוני המשקל/המגמה שסופקו למעלה. אם עברו פחות מ-3 שבועות בין התמונות, לרוב אין עדיין מספיק זמן לקבוע עצירה אמיתית.
5. אם זוהתה עצירה, תן המלצה קונקרטית אחת המתאימה למטרה:
   - ירידה במשקל / Recomp: קיצוץ מדורג של 150-200 קלוריות ביום, או הוספת כ-2,000 צעדים יומיים.
   - מסה מבוקרת: העלאה של 150-200 קלוריות ביום, או בדיקת התקדמות בעומסי האימון (Progressive Overload).
   - אם הבעיה נראית קשורה לאימונים ולא לתזונה: הצע רענון נפח אימון או שבוע דילואד.
6. אם אין עצירה אמיתית - עודד להמשיך באותה גישה, ואל תמליץ על שינוי קלורי.

החזר תשובה אך ורק כאובייקט JSON תקין בפורמט הבא, ללא כל טקסט נוסף, ללא Markdown:
{
  "visualAssessment": "תיאור קצר וכן של ההשוואה הויזואלית (2-3 משפטים)",
  "bodyFatEstimateRange": "טווח הערכה חזותית, למשל '16%-18%', או 'לא ניתן להעריך מהתמונות'",
  "muscleMassTrend": "increase" | "stable" | "decrease",
  "muscleMassNote": "משפט קצר וכן על השינוי הנראה לעין בנפח/הגדרה שרירית",
  "isPlateaued": true | false,
  "recommendationTitle": "כותרת קצרה להמלצה, למשל 'קיצוץ קלורי מדורג' או 'ממשיכים באותה גישה'",
  "recommendationText": "ההמלצה המלאה, מנומקת, 2-4 משפטים",
  "calorieAdjustment": מספר שלם חתום (למשל -175 או 175), או null אם ההמלצה אינה שינוי קלורי
}

אל תמציא מידע רפואי, ואל תמליץ על ירידה קיצונית או מסוכנת בקלוריות. אל תמציא מספר מדויק לאחוז שומן או למסת שריר בק"ג - אלו הערכות חזותיות גסות בלבד.`;
}

function toNullableNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
}

/**
 * Sends one or two progress photos (before/after) plus the user's weight-trend and goal
 * context to Gemini, and returns a structured visual-progress review with an optional
 * actionable calorie-target adjustment.
 */
export async function reviewProgressPhotos(
  images: ImagePart[],
  context: ProgressReviewContext,
): Promise<ProgressReviewResult> {
  const systemInstruction = buildProgressReviewPrompt(context);
  const parts: GeminiPart[] = [
    { text: 'נתחו את תמונות ההתקדמות הבאות (לפי הסדר: לפני, ואז אחרי) והחזירו JSON בפורמט שהוגדר בהוראות המערכת.' },
    ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
  ];

  const text = await callGemini(systemInstruction, [{ role: 'user', parts }], true);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('לא ניתן היה לפענח את תשובת ה-AI. נסו שוב.');
  }

  const obj = (parsed ?? {}) as Record<string, unknown>;
  const muscleMassTrend: MuscleMassTrend =
    obj.muscleMassTrend === 'increase' || obj.muscleMassTrend === 'decrease' ? obj.muscleMassTrend : 'stable';

  return {
    visualAssessment: typeof obj.visualAssessment === 'string' ? obj.visualAssessment : 'לא התקבל ניתוח ויזואלי.',
    bodyFatEstimateRange: typeof obj.bodyFatEstimateRange === 'string' ? obj.bodyFatEstimateRange : 'לא ניתן להעריך מהתמונות',
    muscleMassTrend,
    muscleMassNote: typeof obj.muscleMassNote === 'string' ? obj.muscleMassNote : '',
    isPlateaued: obj.isPlateaued === true,
    recommendationTitle: typeof obj.recommendationTitle === 'string' ? obj.recommendationTitle : 'המלצת AI',
    recommendationText: typeof obj.recommendationText === 'string' ? obj.recommendationText : '',
    calorieAdjustment: toNullableNumber(obj.calorieAdjustment),
  };
}

// ---------------------------------------------------------------------------
// Follow-up discussion on a progress review
// ---------------------------------------------------------------------------

const MUSCLE_TREND_TEXT: Record<MuscleMassTrend, string> = {
  increase: 'עלייה במסת השריר הנראית לעין',
  stable: 'מסת שריר יציבה',
  decrease: 'ירידה במסת השריר הנראית לעין',
};

/** Everything the user is currently looking at in the review modal, injected as context ahead of their question. */
export interface ProgressFollowUpContext extends ProgressReviewContext {
  review: ProgressReviewResult;
}

function buildFollowUpContextBlock(ctx: ProgressFollowUpContext): string {
  const { review } = ctx;
  const weightLine =
    ctx.beforeWeightKg !== undefined && ctx.afterWeightKg !== undefined
      ? `המשקל השתנה מ-${ctx.beforeWeightKg} ל-${ctx.afterWeightKg} ק"ג.`
      : '';
  return `## הקשר: ניתוח ההתקדמות שהמשתמש רואה כעת
המשתמש נמצא בהשוואת תמונות בין ${ctx.beforeDate} ל-${ctx.afterDate} (${ctx.daysBetween} ימים). ${weightLine}
ניתוח ויזואלי העריך: אחוזי שומן ${review.bodyFatEstimateRange}; ${MUSCLE_TREND_TEXT[review.muscleMassTrend]}${review.muscleMassNote ? ` (${review.muscleMassNote})` : ''}; ${review.isPlateaued ? 'זוהתה עצירה בהתקדמות' : 'לא זוהתה עצירה בהתקדמות'}.
סיכום הניתוח: ${review.visualAssessment}
ההמלצה שניתנה: ${review.recommendationTitle} - ${review.recommendationText}

המשתמש ממשיך את הדיון על הניתוח הזה. ענה על שאלתו בצורה ספציפית, מעשית ומותאמת למצבו הפיזי והתזונתי כפי שמופיע למעלה (כולל יעד הקלוריות והמאקרו שלו). התבסס על הניתוח, אל תחזור עליו במלואו, והימנע מהמצאת מספרים מדויקים. תשובה קצרה וברורה (עד כ-120 מילים), עם צעדים קונקרטיים. אל תיתן ייעוץ רפואי.`;
}

/** Continues the conversation about a progress review: the full coach profile prompt plus the latest analysis findings as context. */
export async function sendProgressFollowUp(
  history: ChatMessage[],
  appState: AppState,
  context: ProgressFollowUpContext,
): Promise<string> {
  const systemInstruction = `${buildCoachSystemPrompt(appState)}\n\n${buildFollowUpContextBlock(context)}`;
  const contents: GeminiContent[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  return callGemini(systemInstruction, contents, false);
}
