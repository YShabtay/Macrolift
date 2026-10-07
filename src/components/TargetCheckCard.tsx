import { useMemo, useState } from 'react';
import { Check, Minus, Plus, Scale } from 'lucide-react';
import type { FoodEntry, NutritionPlan, UserMetrics, WeightLog } from '../types/fitness';
import { calculateNutritionPlan } from '../utils/calculations';
import { getCalorieRange } from '../utils/calorieRange';
import { MIN_CHECK_SPAN_DAYS, MIN_CHECK_WEIGH_INS, checkTarget, getCheckStart, type TargetCheckResult } from '../utils/targetCheck';
import { todayIso } from '../utils/weightCalculations';

const DISMISS_KEY = 'macrolift-target-check-dismissed';
const DISMISS_DAYS = 7;
const STEP_KCAL = 50;
const MIN_EDIT_KCAL = 50;
const MAX_EDIT_KCAL = 400;

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
    // Storage blocked: the suggestion simply shows again next time.
  }
}

const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const kg = (n: number) => `${n > 0 ? '+' : ''}${n}`;
const described = (n: number) => `${n > 0 ? 'תוספת' : 'הפחתה'} של ${Math.abs(n).toLocaleString('he-IL')}`;

interface TargetCheckCardProps {
  weightLogs: WeightLog[];
  foodLog: FoodEntry[];
  metrics: UserMetrics;
  profileCreatedAt: string;
  nutritionPlan: NutritionPlan;
  /** Adds this many kcal to the daily target (negative removes); the calorie range, macros and everything built on them follow. */
  onApply: (deltaKcal: number) => void;
  /** 'banner': shown only when there is something to act on (the dashboard). 'card': always, with progress and status (the progress tab). */
  variant: 'banner' | 'card';
}

/**
 * Compares the weekly weight trend with the pace the goal calls for, and when they clearly differ suggests adding or removing calories. The user
 * can accept the suggestion, change the amount, or leave it; accepting recalculates the target and range and starts a fresh two-week check.
 */
export default function TargetCheckCard({ weightLogs, foodLog, metrics, profileCreatedAt, nutritionPlan, onApply, variant }: TargetCheckCardProps) {
  const today = todayIso();
  const [dismissedOn, setDismissedOn] = useState(readDismissed);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(0);

  const result = useMemo(
    () =>
      checkTarget({
        weightLogs,
        foodLog,
        goal: metrics.goal,
        intensity: metrics.goalIntensity,
        weightKg: metrics.weightKg,
        targetCalories: nutritionPlan.targetCalories,
        since: getCheckStart(metrics, profileCreatedAt),
        today,
      }),
    [weightLogs, foodLog, metrics, nutritionPlan.targetCalories, profileCreatedAt, today],
  );

  const currentShift = metrics.targetAdjustmentKcal ?? 0;
  const isDismissed = dismissedOn !== null && daysBetween(dismissedOn, today) < DISMISS_DAYS;
  const actionable = result.status === 'ready' && (result.verdict === 'add' || result.verdict === 'reduce');
  const needsAttention = result.status === 'ready' && (actionable || result.verdict === 'reach-target' || result.verdict === 'hold-target');

  if (variant === 'banner' && (!needsAttention || isDismissed)) return null;

  const suggested = result.status === 'ready' ? result.suggestedDeltaKcal : 0;
  const sign = suggested < 0 ? -1 : 1;
  const chosen = editing ? sign * amount : suggested;
  const preview = calculateNutritionPlan({ ...metrics, targetAdjustmentKcal: currentShift + chosen });
  const previewRange = getCalorieRange(preview);

  function startEditing() {
    setAmount(Math.abs(suggested));
    setEditing(true);
  }

  function apply() {
    onApply(chosen);
    setEditing(false);
  }

  function dismiss() {
    writeDismissed(today);
    setDismissedOn(today);
    setEditing(false);
  }

  return (
    <div className={`glass-card flex flex-col gap-3 p-5 sm:p-6 ${variant === 'banner' ? 'border-lime-400/40' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
          <Scale className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">בדיקת התקדמות לפי המשקל</h3>
          {variant === 'card' && (
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
              אחרי שבועיים עד שלושה של שקילות, האפליקציה משווה את הממוצע השבועי של המשקל לקצב שהמטרה שלך דורשת, ומציעה לתקן את היעד אם יש פער.
            </p>
          )}
        </div>
      </div>

      {result.status === 'collecting' && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          עוד קצת סבלנות: צריך לפחות {MIN_CHECK_WEIGH_INS} שקילות על פני {MIN_CHECK_SPAN_DAYS} ימים מאז שהיעד הנוכחי נקבע. עד עכשיו יש {result.weighIns} שקילות ו-
          {result.spanDays} ימים.
        </p>
      )}

      {result.status === 'ready' && <Verdict result={result} />}

      {actionable && !isDismissed && (
        <div className="rounded-xl border border-lime-400/30 bg-lime-400/5 p-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            מומלץ: {described(chosen)} קק״ל ביום
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            יעד חדש: {preview.targetCalories.toLocaleString('he-IL')} קק״ל (היום {nutritionPlan.targetCalories.toLocaleString('he-IL')})
            {previewRange ? `, טווח ${previewRange.min.toLocaleString('he-IL')}-${previewRange.max.toLocaleString('he-IL')}` : ''}. התזונה, המאקרו והתקציב השבועי יתעדכנו בהתאם.
          </p>

          {editing && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                aria-label="פחות"
                onClick={() => setAmount((a) => Math.max(a - STEP_KCAL, MIN_EDIT_KCAL))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[5.5rem] text-center text-lg font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100">
                {sign > 0 ? '+' : '-'}
                {amount}
              </span>
              <button
                type="button"
                aria-label="יותר"
                onClick={() => setAmount((a) => Math.min(a + STEP_KCAL, MAX_EDIT_KCAL))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="text-xs text-zinc-600 dark:text-zinc-500">קק״ל ביום</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={apply}>
              <Check className="h-4 w-4" />
              עדכון היעד
            </button>
            {!editing && (
              <button type="button" className="btn-secondary" onClick={startEditing}>
                עריכת הכמות
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={dismiss}>
              לא עכשיו
            </button>
          </div>
        </div>
      )}

      {actionable && isDismissed && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
          ההצעה נדחתה לשבוע. היא תופיע שוב אם המגמה תימשך.
        </p>
      )}

      {currentShift !== 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            התאמה פעילה לפי המשקל: {described(currentShift)} קק״ל ביום
            {metrics.targetAdjustmentDate ? ` (מ-${metrics.targetAdjustmentDate.split('-').reverse().slice(0, 2).join('.')})` : ''}
          </p>
          <button
            type="button"
            className="text-xs font-semibold text-zinc-600 underline decoration-dotted underline-offset-4 hover:text-red-400 dark:text-zinc-400"
            onClick={() => onApply(-currentShift)}
          >
            ביטול ההתאמה
          </button>
        </div>
      )}
    </div>
  );
}

function Verdict({ result }: { result: TargetCheckResult }) {
  const trend = `ממוצע שבועי של ${kg(result.slopeKgPerWeek)} ק״ג בשבוע, לעומת הקצב שהמטרה שלך דורשת: ${kg(result.expectedKgPerWeek.min)} עד ${kg(result.expectedKgPerWeek.max)}`;
  switch (result.verdict) {
    case 'on-track':
      return <p className="text-sm text-lime-700 dark:text-lime-400">✓ אתה בקצב: {trend}. ממשיכים כך.</p>;
    case 'unclear':
      return <p className="text-sm text-zinc-700 dark:text-zinc-300">קצת מחוץ לקצב, אבל השקילות מפוזרות מכדי להכריע ({trend}). נמשיך לעקוב עוד שבוע.</p>;
    case 'add':
      return <p className="text-sm text-zinc-700 dark:text-zinc-300">המשקל זז לאט מהמתוכנן: {trend}.</p>;
    case 'reduce':
      return <p className="text-sm text-zinc-700 dark:text-zinc-300">המשקל זז מהר מהמתוכנן: {trend}.</p>;
    case 'reach-target':
      return (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          המשקל זז לאט מהמתוכנן ({trend}), אבל האוכל שתיעדת נמוך מהיעד (בממוצע {result.avgIntake?.toLocaleString('he-IL')} קק״ל). קודם כדאי להגיע ליעד, ואז לבדוק שוב.
        </p>
      );
    case 'hold-target':
      return (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          המשקל זז מהר מהמתוכנן ({trend}), אבל האוכל שתיעדת גבוה מהיעד (בממוצע {result.avgIntake?.toLocaleString('he-IL')} קק״ל). קודם כדאי לאכול לפי היעד, ואז לבדוק שוב.
        </p>
      );
  }
}
