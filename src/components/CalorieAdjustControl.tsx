import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, SlidersHorizontal, X } from 'lucide-react';
import type { UserMetrics } from '../types/fitness';
import { calculateNutritionPlan } from '../utils/calculations';
import { getCalorieRange } from '../utils/calorieRange';
import { MAX_TARGET_ADJUSTMENT_KCAL } from '../utils/targetCheck';

const STEP_KCAL = 50;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('he-IL')}`;

interface CalorieAdjustControlProps {
  metrics: UserMetrics;
  /** Adds this many kcal to the daily target (negative removes). The target, range, macros and everything built on them follow, and the weight-trend check restarts. */
  onApply: (deltaKcal: number) => void;
}

/**
 * A manual change to the calorie target, for trying a different amount (for example a little more, when the weight is not moving on the number
 * shown). It uses the same correction the weight-trend suggestion applies, so every screen that shows calories follows, and the trend check starts over
 * from today to see whether the change moved the weight.
 */
export default function CalorieAdjustControl({ metrics, onApply }: CalorieAdjustControlProps) {
  const current = metrics.targetAdjustmentKcal ?? 0;
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState(current);

  const base = calculateNutritionPlan({ ...metrics, targetAdjustmentKcal: undefined });
  const preview = calculateNutritionPlan({ ...metrics, targetAdjustmentKcal: candidate });
  const previewRange = getCalorieRange(preview);
  const against = (metrics.goal === 'gain_muscle' && candidate < 0) || (metrics.goal === 'lose_weight' && candidate > 0);

  function openModal() {
    setCandidate(current);
    setOpen(true);
  }

  function nudge(delta: number) {
    setCandidate((c) => Math.max(-MAX_TARGET_ADJUSTMENT_KCAL, Math.min(MAX_TARGET_ADJUSTMENT_KCAL, c + delta)));
  }

  function apply() {
    onApply(candidate - current);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-500 underline decoration-dotted underline-offset-2 transition hover:text-lime-700 dark:hover:text-lime-400"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {current !== 0 ? `התאמה אישית ליעד: ${signed(current)} קק״ל` : 'התאמה ידנית של יעד הקלוריות'}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)}>
            <div
              className="glass-card neon-border flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto p-5 shadow-glow animate-slide-up"
              role="dialog"
              aria-modal="true"
              aria-labelledby="calorie-adjust-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 id="calorie-adjust-title" className="font-bold text-zinc-900 dark:text-zinc-100">
                  התאמה ידנית של יעד הקלוריות
                </h3>
                <button type="button" onClick={() => setOpen(false)} aria-label="סגירה" className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                היעד הוא הערכה, ולכל אחד הגוף מגיב קצת אחרת. אם אתה אוכל את המספר ולמשקל אין תזוזה, אפשר לנסות קצת יותר או פחות ולבדוק מה קורה.
              </p>

              <div className="flex items-center justify-center gap-4">
                <button type="button" onClick={() => nudge(-STEP_KCAL)} disabled={candidate <= -MAX_TARGET_ADJUSTMENT_KCAL} aria-label="הפחתת 50 קק״ל" className="btn-secondary h-11 w-11 justify-center p-0 disabled:opacity-30">
                  <Minus className="h-4 w-4" />
                </button>
                <div className="min-w-[8rem] text-center">
                  <p className="text-3xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100">{preview.targetCalories.toLocaleString('he-IL')}</p>
                  <p className="text-[11px] text-zinc-500">קק״ל ביום</p>
                </div>
                <button type="button" onClick={() => nudge(STEP_KCAL)} disabled={candidate >= MAX_TARGET_ADJUSTMENT_KCAL} aria-label="תוספת של 50 קק״ל" className="btn-secondary h-11 w-11 justify-center p-0 disabled:opacity-30">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                <p>
                  לפי החישוב: <b>{base.targetCalories.toLocaleString('he-IL')}</b> קק״ל · ההתאמה שלך: <b>{candidate === 0 ? 'ללא' : `${signed(candidate)} קק״ל`}</b>
                </p>
                {previewRange && <p className="mt-1">הטווח המומלץ זז איתה: {previewRange.min.toLocaleString('he-IL')}-{previewRange.max.toLocaleString('he-IL')} קק״ל.</p>}
                <p className="mt-1">
                  חלבון {preview.macros.proteinG} · שומן {preview.macros.fatG} · פחמימה {preview.macros.carbsG} גרם
                </p>
              </div>

              {against && (
                <p className="text-[11px] leading-relaxed text-orange-700 dark:text-orange-400">
                  {metrics.goal === 'gain_muscle' ? 'ההתאמה מורידה את היעד, וזה יאט את העלייה במשקל.' : 'ההתאמה מעלה את היעד, וזה יאט את הירידה במשקל.'}
                </p>
              )}
              {candidate !== 0 && preview.targetCalories !== base.targetCalories + candidate && (
                <p className="text-[11px] leading-relaxed text-orange-700 dark:text-orange-400">היעד לא ירד מתחת לחילוף החומרים הבסיסי, ולכן ההתאמה בפועל קטנה יותר.</p>
              )}

              <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
                אחרי השינוי הבדיקה מתחילה מחדש: האפליקציה תשווה את הממוצע השבועי של המשקל אחרי 2-3 שבועות ותגיד אם ההתאמה הזיזה אותו. כדי שהבדיקה תהיה
                אמינה צריך באמת לאכול את היעד החדש, ולשקול כמה פעמים בשבוע.
              </p>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={apply} disabled={candidate === current} className="btn-primary text-xs disabled:opacity-40">
                  החלת היעד
                </button>
                {current !== 0 && (
                  <button type="button" onClick={() => setCandidate(0)} disabled={candidate === 0} className="btn-secondary text-xs disabled:opacity-40">
                    חזרה לחישוב המקורי
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-xs">
                  ביטול
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
