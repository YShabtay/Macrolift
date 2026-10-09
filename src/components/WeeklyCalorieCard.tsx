import { CalendarRange } from 'lucide-react';
import type { WeeklyCalorieBudget } from '../utils/calorieBudget';
import { formatDateDisplay } from '../utils/weightCalculations';

/** The week's calorie budget at a glance, and (for the current week) a gentle pace for today. Information only: the daily target is unchanged. */
export default function WeeklyCalorieCard({
  budget,
  isToday = true,
  onChooseAllowance,
}: {
  budget: WeeklyCalorieBudget;
  /** False while looking at yesterday (still being filled in): the wording says "this day" instead of "today". */
  isToday?: boolean;
  /** Puts the step credit on today and the next days (1 = today only), or with null leaves it shared over every day left. */
  onChooseAllowance?: (days: number | null) => void;
}) {
  const percent = budget.weeklyTarget > 0 ? Math.min(Math.round((budget.eaten / budget.weeklyTarget) * 100), 100) : 0;
  const isOver = budget.remaining < 0;

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">תקציב קלוריות שבועי</h3>
        </div>
        <span className="text-[11px] text-zinc-500">
          {formatDateDisplay(budget.weekStart)} - {formatDateDisplay(budget.weekEnd)}
        </span>
      </div>

      <div className="mb-1.5 flex items-end justify-between gap-2">
        <p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {budget.eaten.toLocaleString()}
          <span className="font-medium text-zinc-500"> / {budget.weeklyTarget.toLocaleString()} קק״ל</span>
        </p>
        <p className={`text-xs font-bold tabular-nums ${isOver ? 'text-orange-700 dark:text-orange-400' : 'text-lime-700 dark:text-lime-400'}`}>
          {isOver ? `חריגה של ${Math.abs(budget.remaining).toLocaleString()}` : `נשארו ${budget.remaining.toLocaleString()}`}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-orange-400' : 'bg-lime-400'}`} style={{ width: `${percent}%` }} />
      </div>

      {budget.pace && (
        <p className="mt-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          <span className="font-bold">{isToday ? 'מומלץ להיום' : 'מומלץ ליום הזה'}: {budget.pace.kcal.toLocaleString()} קק״ל</span>
          {budget.pace.kcal !== budget.pace.target && <span className="text-zinc-500"> (היעד היומי {budget.pace.target.toLocaleString()})</span>}
          <br />
          <span className="text-zinc-600 dark:text-zinc-400">
            מה שנשאר מהתקציב אחרי הימים הקודמים, מחולק על {budget.pace.daysLeft} {budget.pace.daysLeft === 1 ? 'יום' : 'ימים'}.
            {budget.pace.stepCreditKcal >= 10 &&
              ` כולל תוספת של כ-${budget.pace.stepCreditKcal.toLocaleString()} קק״ל מהצעדים, ${
                budget.pace.allowanceDays === 0
                  ? `שמתחלקת על ${budget.pace.daysLeft} הימים הקרובים (כ-${Math.round(budget.pace.stepCreditKcal / budget.pace.daysLeft).toLocaleString()} ליום)`
                  : budget.pace.allowanceDays === 1
                    ? (isToday ? 'שמנוצלת היום בלבד (היא כבר בתוך יעד היום)' : 'שמנוצלת ביום הזה בלבד (היא כבר בתוך היעד שלו)')
                    : `שמנוצלת על ${budget.pace.allowanceDays} ימים (היא כבר בתוך יעד כל אחד מהם)`
              }, כי השבוע הלכת נטו יותר מיעד הצעדים.`}
            {budget.pace.stepCreditKcal <= -10 && ` כולל הפחתה של כ-${Math.abs(budget.pace.stepCreditKcal).toLocaleString()} קק״ל לכל שאר השבוע (כ-${Math.round(Math.abs(budget.pace.stepCreditKcal) / budget.pace.daysLeft).toLocaleString()} ליום), כי השבוע הלכת נטו פחות מיעד הצעדים.`}
            {budget.pace.clamped === 'up' && ' הוגבל ל-15% מעל היעד: לא כדאי "לפצות" על ימי אכילה קלה בבת אחת.'}
            {budget.pace.clamped === 'down' && ' הוגבל כדי לא לרדת מתחת לחילוף החומרים הבסיסי או מתחת ל-85% מהיעד.'}
          </span>
        </p>
      )}
      {budget.pace && budget.pace.stepCreditKcal >= 10 && budget.pace.daysLeft >= 2 && onChooseAllowance && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">את התוספת מהצעדים לנצל:</p>
          <div className="flex gap-2" role="radiogroup" aria-label="פיזור התוספת מהצעדים">
            {Array.from({ length: Math.min(budget.pace.daysLeft, 3) }, (_, i) => (i + 1 === 3 && budget.pace!.daysLeft > 3 ? budget.pace!.daysLeft : i + 1)).map((days) => {
              const isAll = days === budget.pace!.daysLeft;
              const selected = isAll ? budget.pace!.allowanceDays === 0 : budget.pace!.allowanceDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChooseAllowance(isAll ? null : days)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                    selected
                      ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {days === 1 ? (isToday ? 'היום בלבד' : 'היום הזה בלבד') : isAll ? `כל ${days} הימים` : `${days} ימים`}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">הבחירה מעדכנת את היעד היומי בכל המסכים.</p>
        </div>
      )}
      {budget.unloggedDays > 0 && (
        <p className="mt-2 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
          {budget.unloggedDays} {budget.unloggedDays === 1 ? 'יום קודם לא תועד' : 'ימים קודמים לא תועדו'}. בהמלצה להיום הם נספרים כימים שעמדו ביעד, ובסיכום למעלה הם נספרים כאפס. אפשר להשלים אותם דרך הרצועה.
        </p>
      )}
    </div>
  );
}
