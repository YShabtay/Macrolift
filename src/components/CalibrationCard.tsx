import { useMemo, useState } from 'react';
import { Gauge } from 'lucide-react';
import type { FoodEntry, NutritionPlan, UserMetrics, WeightLog } from '../types/fitness';
import { calculateNutritionPlan } from '../utils/calculations';
import { MIN_LOGGED_DAYS, MIN_SPAN_DAYS, MIN_WEIGH_INS, observeTdee, suggestAdjustment } from '../utils/calibration';
import { todayIso } from '../utils/weightCalculations';

const DISMISS_KEY = 'macrolift-calibration-dismissed';
const DISMISS_DAYS = 7;

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(date: string) {
  try {
    localStorage.setItem(DISMISS_KEY, date);
  } catch {
    // Storage blocked: the card simply shows again next time.
  }
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** "תוספת של 75" / "הפחתה של 75": words read the same in a right-to-left line, where a minus sign can jump to the other side of the number. */
const described = (n: number) => `${n > 0 ? 'תוספת' : 'הפחתה'} של ${Math.abs(n).toLocaleString('he-IL')}`;

function Progress({ label, value, goal }: { label: string; value: number; goal: number }) {
  const done = Math.min(value, goal);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">
          {value}/{goal}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-lime-400 transition-all" style={{ width: `${(done / goal) * 100}%` }} />
      </div>
    </div>
  );
}

interface CalibrationCardProps {
  foodLog: FoodEntry[];
  weightLogs: WeightLog[];
  metrics: UserMetrics;
  nutritionPlan: NutritionPlan;
  onSetAdjustment: (adjustmentKcal: number) => void;
}

/**
 * Checks the calorie formula against the user's own food log and weight trend, and offers to correct their TDEE when the two disagree.
 * The formula is an average of many people; this is the only part of the calorie target that comes from the user's own body.
 */
export default function CalibrationCard({ foodLog, weightLogs, metrics, nutritionPlan, onSetAdjustment }: CalibrationCardProps) {
  const today = todayIso();
  const [dismissedOn, setDismissedOn] = useState(readDismissed);
  const currentAdjustment = metrics.tdeeAdjustmentKcal ?? 0;

  const observation = useMemo(() => observeTdee(foodLog, weightLogs, today), [foodLog, weightLogs, today]);
  const formulaTdee = useMemo(() => calculateNutritionPlan({ ...metrics, tdeeAdjustmentKcal: 0 }).tdee, [metrics]);

  const suggestion = observation.status === 'ready' ? suggestAdjustment(observation, formulaTdee, currentAdjustment) : null;
  const isDismissed = dismissedOn !== null && daysBetween(dismissedOn, today) < DISMISS_DAYS;
  const newTarget = suggestion ? calculateNutritionPlan({ ...metrics, tdeeAdjustmentKcal: suggestion.suggestedAdjustment }).targetCalories : null;

  return (
    <div className="glass-card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
          <Gauge className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">כיול אישי של הקלוריות</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
            הנוסחה מעריכה כמה אתה שורף לפי הממוצע של אנשים, ובפועל זה יכול להיות שונה בכ-10%. המשקל שלך מראה מה באמת קורה: אם אתה אוכל כמות קבועה והמשקל לא זז, זו
            התחזוקה שלך.
          </p>
        </div>
      </div>

      {observation.status === 'collecting' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            כדי לבדוק את זה צריך כ-4 שבועות של תיעוד אוכל ושקילות. הנתונים של 28 הימים האחרונים:
          </p>
          <Progress label="ימים עם תיעוד אוכל מלא" value={observation.loggedDays} goal={MIN_LOGGED_DAYS} />
          <Progress label="שקילות" value={observation.weighIns} goal={MIN_WEIGH_INS} />
          <Progress label="ימים בין השקילה הראשונה לאחרונה" value={observation.spanDays} goal={MIN_SPAN_DAYS} />
        </div>
      )}

      {observation.status === 'ready' && suggestion && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="אכלת בממוצע" value={observation.avgIntake.toLocaleString('he-IL')} unit="קק״ל ביום" />
            <Stat
              label="שינוי משקל"
              value={`${observation.slopeKgPerWeek > 0 ? '+' : ''}${observation.slopeKgPerWeek}`}
              unit="ק״ג בשבוע"
            />
            <Stat label="שריפה לפי התיעוד" value={observation.observedTdee.toLocaleString('he-IL')} unit="קק״ל ביום" />
          </div>
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
            הנוסחה מעריכה {formulaTdee.toLocaleString('he-IL')} קק״ל ביום{currentAdjustment !== 0 ? `, ועם ההתאמה שלך ${nutritionPlan.tdee.toLocaleString('he-IL')}` : ''}. ההערכה לפי הנתונים
            מדויקת בערך ל-±{observation.uncertaintyKcal} קק״ל, לכן ההצעה מתקרבת אליה רק בחלקה ({Math.round(suggestion.trust * 100)}%).
          </p>

          {suggestion.worthSuggesting && newTarget !== null && !isDismissed ? (
            <div className="rounded-xl border border-lime-400/30 bg-lime-400/5 p-4">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                מציע לעדכן את השריפה המשוערת: {described(suggestion.suggestedAdjustment)} קק״ל ביום
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                יעד הקלוריות היומי יהיה {newTarget.toLocaleString('he-IL')} (היום {nutritionPlan.targetCalories.toLocaleString('he-IL')}).
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn-primary" onClick={() => onSetAdjustment(suggestion.suggestedAdjustment)}>
                  עדכון היעד
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    writeDismissed(today);
                    setDismissedOn(today);
                  }}
                >
                  השארת היעד כמו שהוא
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              {suggestion.worthSuggesting
                ? 'הצעה לעדכון נדחתה לשבוע. היא תופיע שוב אם הנתונים ימשיכו להצביע על אותו כיוון.'
                : 'היעד הנוכחי מתאים למה שקורה בפועל. נמשיך לעקוב ולעדכן.'}
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-500">
        ההערכה נמדדת בקלוריות כפי שאתה מתעד אותן. אנשים נוטים לרשום קצת פחות ממה שאכלו, ולכן מה שחשוב הוא לתעד באותה דרך כל יום: אז היעד מתאים בדיוק לדרך התיעוד שלך. שקילות עקביות באותו שעה משפרות אותה. התאמה לא עולה על 500 קק״ל.
      </p>

      {currentAdjustment !== 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">התאמה אישית פעילה: {described(currentAdjustment)} קק״ל ביום</p>
          <button type="button" className="text-xs font-semibold text-zinc-600 underline decoration-dotted underline-offset-4 hover:text-red-400 dark:text-zinc-400" onClick={() => onSetAdjustment(0)}>
            חזרה לנוסחה
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="text-[11px] text-zinc-600 dark:text-zinc-500">{label}</p>
      <p className="text-lg font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-[10px] text-zinc-500">{unit}</p>
    </div>
  );
}
