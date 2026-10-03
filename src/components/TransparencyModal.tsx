import { formatMacro } from '../utils/formatMacro';
import { getActivityMultiplier } from '../utils/calculations';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Flame, GraduationCap, PieChart, Target, X } from 'lucide-react';
import type { Goal, NutritionPlan, UserMetrics } from '../types/fitness';

interface TransparencyModalProps {
  metrics: UserMetrics;
  nutritionPlan: NutritionPlan;
  /** 'button' renders a full primary-style trigger; 'link' renders a small inline text link. */
  variant?: 'button' | 'link';
}

function getGoalExplanation(metrics: UserMetrics, nutritionPlan: NutritionPlan): string {
  const delta = Math.abs(nutritionPlan.calorieDeficitOrSurplus);
  const goal: Goal = metrics.goal;

  switch (goal) {
    case 'gain_muscle': {
      const intensityLabel = metrics.goalIntensity === 'aggressive' ? 'אגרסיבית' : 'מתונה ומבוקרת';
      return `בחרת במסה מבוקרת (Lean Bulk) בעצימות ${intensityLabel} – הוספנו כ-${delta} קק״ל בלבד מעל התחזוקה (TDEE) כדי למקסם בניית שריר ולמנוע צבירת שומן מיותרת.`;
    }
    case 'lose_weight':
      return `בחרת בירידה במשקל – יצרנו גירעון של כ-${delta} קק״ל ביום מתחת לתחזוקה (ולא מתחת לחילוף החומרים הבסיסי שלך), קצב שנחשב בטוח ובר-קיימא לירידה בשומן תוך שמירה מרבית על מסת השריר.`;
    case 'recomp':
      return `בחרת בשיפור הרכב גוף – גירעון קל של כ-${delta} קק״ל (כ-5% מתחת לתחזוקה) מאפשר ירידה הדרגתית בשומן תוך שמירה על מסת השריר, בשילוב אימוני כוח וחלבון גבוה.`;
    case 'maintain':
    default:
      return 'בחרת בשמירה על המשקל – היעד הקלורי שלך נקבע בדיוק לפי התחזוקה (TDEE), כדי לשמר את המשקל הנוכחי תוך שיפור הרגלים ואיכות התזונה.';
  }
}

export default function TransparencyModal({ metrics, nutritionPlan, variant = 'button' }: TransparencyModalProps) {
  const [open, setOpen] = useState(false);
  const { macros } = nutritionPlan;
  const proteinPerKg = (macros.proteinG / metrics.weightKg).toFixed(1);
  const fatCaloriePercent = Math.round(((macros.fatG * 9) / nutritionPlan.targetCalories) * 100);

  return (
    <>
      {variant === 'button' ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
          <GraduationCap className="h-4 w-4" />
          איך הגענו לנתונים שלך?
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-500 underline decoration-dotted underline-offset-2 transition hover:text-lime-700 dark:hover:text-lime-400"
        >
          <GraduationCap className="h-3.5 w-3.5" />
          איך חישבנו את זה?
        </button>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          >
            <div
              className="glass-card neon-border flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto shadow-glow animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-4 backdrop-blur">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-lime-700 dark:text-lime-400" />
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">איך הגענו לנתונים שלך?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="סגירה"
                  className="text-zinc-600 dark:text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4 p-5 sm:p-6">
                <ExplanationSection
                  icon={Flame}
                  title="חישוב ה-TDEE"
                  text={`חילוף החומרים שלך במנוחה (BMR) הוא ${nutritionPlan.bmr} קק״ל ליום. בהתחשב ב-${metrics.trainingDaysPerWeek} אימוני כוח בשבוע ובממוצע של כ-${metrics.averageDailySteps.toLocaleString('he-IL')} צעדים (מקדם פעילות של כ-${getActivityMultiplier(metrics.averageDailySteps, metrics.trainingDaysPerWeek).toFixed(2)}), אנחנו מעריכים שאתה שורף בממוצע ${nutritionPlan.tdee} קק״ל ביום (TDEE) - זו נקודת הייחוס לחישוב היעד הקלורי שלך.`}
                />
                <ExplanationSection
                  icon={Target}
                  title="הגירעון / העודף הקלורי"
                  text={getGoalExplanation(metrics, nutritionPlan)}
                />
                <ExplanationSection
                  icon={PieChart}
                  title="חלוקת המאקרונוטריאנטים"
                  text={`קבענו ${proteinPerKg} גרם חלבון לכל ק״ג משקל גוף (סה״כ ${formatMacro(macros.proteinG)} גרם) כדי לתמוך בשימור ובניית מסת שריר, כ-${fatCaloriePercent}% מהקלוריות משומן (${formatMacro(macros.fatG)} גרם) לשמירה על תפקוד הורמונלי תקין, והשאר - ${formatMacro(macros.carbsG)} גרם פחמימה - לאנרגיה ולביצועים באימונים.`}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function ExplanationSection({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Flame;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-lime-700 dark:text-lime-400" />
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{title}</h4>
      </div>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{text}</p>
    </div>
  );
}
