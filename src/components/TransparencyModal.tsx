import { formatMacro } from '../utils/formatMacro';
import { getCalorieRange } from '../utils/calorieRange';
import { estimateEnergyExpenditure } from '../utils/calculations';
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

function getEnergyExplanation(metrics: UserMetrics, nutritionPlan: NutritionPlan): string {
  const energy = estimateEnergyExpenditure({
    bmr: nutritionPlan.bmr,
    weightKg: metrics.weightKg,
    dailySteps: metrics.averageDailySteps,
    trainingDaysPerWeek: metrics.trainingDaysPerWeek,
    sessionMinutes: metrics.sessionMinutes,
  });
  const adjustment = Math.round(metrics.tdeeAdjustmentKcal ?? 0);
  const parts = `חילוף החומרים שלך במנוחה (BMR) הוא ${nutritionPlan.bmr} קק״ל ליום. החיים הרגילים של אדם פעיל במידה קלה, כולל הליכה בסיסית, מוסיפים ${energy.baseKcal}. עוד כ-${energy.stepsKcal} מהליכה מעל 4,000 צעדים (הממוצע שלך: ${metrics.averageDailySteps.toLocaleString('he-IL')}), וכ-${energy.trainingKcal} ליום מ-${metrics.trainingDaysPerWeek} אימוני כוח בשבוע${metrics.sessionMinutes ? ` (כ-${metrics.sessionMinutes} דקות כל אחד, לפי הסטים והמנוחות של התוכנית שלך)` : ''}.`;
  const personal = adjustment !== 0 ? ` בנוסף יש התאמה אישית (${adjustment > 0 ? 'תוספת' : 'הפחתה'} של ${Math.abs(adjustment)} קק״ל), לפי מה שאכלת ואיך המשקל שלך השתנה.` : '';
  return `${parts}${personal} אנחנו מעריכים שאתה שורף בממוצע ${nutritionPlan.tdee} קק״ל ביום (TDEE) - זו נקודת הייחוס לחישוב היעד הקלורי שלך. זו הערכה: חילוף החומרים של אנשים שונה בכ-10%, ולכן מומלץ לבדוק אותה מול המשקל שלך (ראה "כיול אישי" בעמוד ההתקדמות).`;
}

function getGoalExplanation(metrics: UserMetrics, nutritionPlan: NutritionPlan): string {
  const offset = Math.abs(nutritionPlan.intendedOffsetKcal ?? nutritionPlan.calorieDeficitOrSurplus);
  const range = getCalorieRange(nutritionPlan);
  const rangeText = range ? `${range.min.toLocaleString('he-IL')}-${range.max.toLocaleString('he-IL')}` : '';
  const weeklyLow = (metrics.weightKg * 0.0025).toFixed(2);
  const weeklyHigh = (metrics.weightKg * 0.005).toFixed(2);
  const goal: Goal = metrics.goal;

  switch (goal) {
    case 'gain_muscle': {
      const intensityLabel = metrics.goalIntensity === 'aggressive' ? 'אגרסיבית' : 'מתונה ומבוקרת';
      const rangeNote = range
        ? ` מכיוון שהתחזוקה היא הערכה (בטעות של כ-8% לכל כיוון), הטווח הוא ${rangeText} קק״ל, והיעד מתחיל בקצה הנמוך שלו: זה עדיין עודף אמיתי מעל ההערכה, אבל זהיר מספיק כדי שגם אם התחזוקה שלך נמוכה, לא תצבור שומן מהר מדי. אחרי שבועיים, אם הממוצע השבועי של המשקל עולה פחות מ-${weeklyLow} ק״ג בשבוע, אפשר לעלות לכיוון הקצה העליון; אם הוא עולה יותר מ-${weeklyHigh} ק״ג בשבוע, כדאי להישאר בקצה הנמוך.`
        : '';
      return `בחרת במסה מבוקרת (Lean Bulk) בעצימות ${intensityLabel} – עודף של כ-${offset} קק״ל מעל התחזוקה (TDEE) כדי למקסם בניית שריר ולמנוע צבירת שומן מיותרת.${rangeNote}`;
    }
    case 'lose_weight': {
      const rangeNote = range
        ? ` מכיוון שהתחזוקה היא הערכה, הטווח הוא ${rangeText} קק״ל, והיעד מתחיל בקצה הגבוה שלו, כדי שהירידה תהיה מתונה ובטוחה לשריר גם אם התחזוקה שלך גבוהה מההערכה. אחרי שבועיים, אם הממוצע השבועי של המשקל לא יורד, אפשר לרדת לכיוון הקצה הנמוך.`
        : '';
      return `בחרת בירידה במשקל – גירעון של כ-${offset} קק״ל ביום מתחת לתחזוקה (ולא מתחת לחילוף החומרים הבסיסי שלך), קצב שנחשב בטוח ובר-קיימא לירידה בשומן תוך שמירה מרבית על מסת השריר.${rangeNote}`;
    }
    case 'recomp':
      return `בחרת בשיפור הרכב גוף – גירעון קל של כ-${offset} קק״ל (כ-5% מתחת לתחזוקה) מאפשר ירידה הדרגתית בשומן תוך שמירה על מסת השריר, בשילוב אימוני כוח וחלבון גבוה.${range ? ` הטווח הוא ${rangeText} קק״ל.` : ''}`;
    case 'maintain':
    default:
      return `בחרת בשמירה על המשקל – היעד הקלורי שלך נקבע לפי התחזוקה (TDEE), כדי לשמר את המשקל הנוכחי תוך שיפור הרגלים ואיכות התזונה.${range ? ` הטווח הוא ${rangeText} קק״ל.` : ''}`;
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
                  text={getEnergyExplanation(metrics, nutritionPlan)}
                />
                <ExplanationSection
                  icon={Target}
                  title="הגירעון / העודף הקלורי"
                  text={`${getGoalExplanation(metrics, nutritionPlan)}${
                    metrics.targetAdjustmentKcal
                      ? ` בנוסף יש התאמה אישית של ${metrics.targetAdjustmentKcal > 0 ? '+' : '-'}${Math.abs(metrics.targetAdjustmentKcal)} קק״ל ליום, שהתקבלה מהצעת מגמת המשקל או נקבעה ידנית, והיא כבר כלולה ביעד ובטווח.`
                      : ''
                  }`}
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
