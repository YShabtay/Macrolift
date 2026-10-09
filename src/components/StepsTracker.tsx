import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, Footprints, Pencil } from 'lucide-react';
import type { StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { useToday } from '../hooks/useToday';
import { parseIsoDate, formatIsoDate, formatDateDisplay } from '../utils/weightCalculations';
import { estimateStepCalories, getStepsForDate } from '../utils/stepsCalculations';
import { getCarriedBonus, getStepBoostBreakdown, type StepBoostBreakdown } from '../utils/weeklyBalance';
import { getStepBoostExtraSteps, getWeeklyStepsPlan, stepBonusKcal, type StepGoalMode, type StepMode } from '../utils/weeklySteps';
import { QuickStepsModal, StepGoalModal } from './StepsModals';
import Toast from './Toast';

interface StepsTrackerProps {
  stepLogs: StepLog[];
  /** The user's own daily goal, without any temporary weekly-rebalance boost - what the goal editor changes. */
  baseGoalSteps: number;
  /** 'weekly': baseGoalSteps is a per-day average and each day's goal is what remains of the week; 'daily': a fixed goal for every day. */
  goalMode: StepGoalMode;
  /** Temporary weekly rebalance; adds extra steps to the goal on the days it covers. */
  weeklyBalance?: WeeklyBalanceAdjustment;
  weightKg: number;
  /** Saves (or overwrites) the step count of one date - works for today and for past days alike. */
  onSaveSteps: (date: string, steps: number) => void;
  onSaveGoal: (goal: number, mode: StepGoalMode) => void;
  /** What walking above the goal does: lowers what the coming days need (calories untouched), or is added to that day's calories (the goal stays). */
  stepMode: StepMode;
  onSaveStepMode: (mode: StepMode) => void;
  /** In the "add calories" mode: the calories in the week's bank that today's target includes (carried from earlier days plus today's steps); 0 otherwise. */
  bankKcal?: number;
  /** Removes the extra steps a calorie rebalance added to the week (the choice "make up the overshoot by walking"). */
  onClearRebalanceSteps?: () => void;
}

/** Weekly mode folds a rebalance's extra walking into the week's total, so the per-day boost breakdown doesn't apply. */
const NO_BOOST: StepBoostBreakdown = { active: false, gross: 0, credited: 0, net: 0, creditFromYesterdayOnly: false };

const WEEKDAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const WEEKDAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

function shiftDate(date: string, days: number): string {
  const d = parseIsoDate(date);
  d.setDate(d.getDate() + days);
  return formatIsoDate(d);
}

/** "היום", "אתמול", or "יום רביעי 30.09". */
function describeDate(date: string, today: string): string {
  if (date === today) return 'היום';
  if (date === shiftDate(today, -1)) return 'אתמול';
  return `${WEEKDAY_NAMES[parseIsoDate(date).getDay()]} ${formatDateDisplay(date)}`;
}

export default function StepsTracker({ stepLogs, baseGoalSteps, goalMode, weeklyBalance, weightKg, onSaveSteps, onSaveGoal, stepMode, onSaveStepMode, bankKcal = 0, onClearRebalanceSteps }: StepsTrackerProps) {
  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const [isLogging, setIsLogging] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isToday = selectedDate === today;
  const dateLabel = describeDate(selectedDate, today);
  const selectedSteps = useMemo(() => getStepsForDate(stepLogs, selectedDate), [stepLogs, selectedDate]);

  // The goal that applies to the viewed day. In the weekly mode it is the daily goal as set; what walking above it does is shown next to it (the coming
  // days need less, or the day gets calories). Only in the "balance steps" mode does a "walk more" rebalance add to the week's total.
  const isWeekly = goalMode === 'weekly';
  const walksMore = stepMode === 'balance_steps';
  const extraSteps = walksMore ? getStepBoostExtraSteps(weeklyBalance, selectedDate) : 0;
  const weekly = useMemo(() => getWeeklyStepsPlan(baseGoalSteps, stepLogs, selectedDate, extraSteps), [baseGoalSteps, stepLogs, selectedDate, extraSteps]);
  const boost = isWeekly || !walksMore ? NO_BOOST : getStepBoostBreakdown(baseGoalSteps, weeklyBalance, selectedDate, stepLogs);
  // Weekly goal with the "balance steps" mode: today's goal is what the week still needs shared over today and the days after it. Otherwise the goal as set.
  const goalSteps = isWeekly && walksMore ? weekly.targetForTodayAndRemaining : baseGoalSteps + boost.net;
  const tomorrowBoost = isToday && !isWeekly && walksMore ? getStepBoostBreakdown(baseGoalSteps, weeklyBalance, shiftDate(today, 1), stepLogs) : null;

  // Endowed progress: when bonus steps from earlier days are being credited against a rebalance, the ring shows them as already walked
  // against the FULL compensated target. The steps still to go are identical to (net goal - steps today); it just doesn't look like zero.
  const hasCredit = boost.active && boost.credited > 0;
  const displaySteps = selectedSteps + (hasCredit ? boost.credited : 0);
  const displayGoal = hasCredit ? baseGoalSteps + boost.gross : goalSteps;
  // A goal of 0 (weekly mode, when earlier days already covered the whole week) counts as met.
  const progress = displayGoal > 0 ? Math.min(displaySteps / displayGoal, 1) : 1;
  const percent = displayGoal > 0 ? Math.min(100, Math.round((displaySteps / displayGoal) * 100)) : 100;
  const creditSource = boost.creditFromYesterdayOnly ? 'אתמול' : 'הימים הקודמים';

  // A past day that beat its goal: celebrate it, and say if its extra steps were carried into a rebalance.
  const carried = !isToday && !isWeekly ? getCarriedBonus(baseGoalSteps, weeklyBalance, selectedDate, stepLogs) : null;
  const metGoal = !isToday && selectedSteps > 0 && selectedSteps >= goalSteps;
  const caloriesBurned = estimateStepCalories(selectedSteps, weightKg);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  // Ring geometry: a credit slice (amber) first, then the steps walked (green) continuing from there; together never past a full circle.
  const creditFrac = hasCredit && displayGoal > 0 ? Math.min(boost.credited / displayGoal, 1) : 0;
  const todayFrac = displayGoal > 0 ? Math.min(selectedSteps / displayGoal, 1 - creditFrac) : 0;

  const last7Days = useMemo(() => {
    const days: { date: string; steps: number; goal: number; weekday: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = shiftDate(today, -i);
      days.push({
        date: key,
        steps: getStepsForDate(stepLogs, key),
        goal: isWeekly ? baseGoalSteps : baseGoalSteps + getStepBoostBreakdown(baseGoalSteps, weeklyBalance, key, stepLogs).net,
        weekday: parseIsoDate(key).getDay(),
      });
    }
    return days;
  }, [stepLogs, today, baseGoalSteps, weeklyBalance, isWeekly]);
  const historyMax = Math.max(...last7Days.map((d) => d.steps), goalSteps, 1);

  return (
    <div className="glass-card p-5 transition hover:border-lime-400/30 hover:shadow-glow sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Footprints className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">{isWeekly ? 'צעדים - ממוצע שבועי' : 'צעדים יומיים'}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
            aria-label="היום הקודם"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs font-bold text-zinc-800 dark:text-zinc-200">{dateLabel}</span>
          <button
            type="button"
            onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
            disabled={isToday}
            aria-label="היום הבא"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <StepModeToggle mode={stepMode} onChange={onSaveStepMode} />

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
        <div className="flex shrink-0 flex-col items-center">
          <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r={radius} fill="none" className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="8" />
              {/* Segment A: credit carried from earlier days (amber), the first slice of the ring. */}
              {creditFrac > 0 && (
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="#f59e0b"
                  strokeOpacity="0.85"
                  strokeWidth="8"
                  strokeDasharray={`${creditFrac * circumference} ${circumference}`}
                  className="transition-[stroke-dasharray] duration-500 ease-out"
                />
              )}
              {/* Segment B: steps actually walked, continuing from where the credit ends (neon green). */}
              {todayFrac > 0 && (
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="#a3e635"
                  strokeWidth="8"
                  strokeLinecap={creditFrac > 0 ? 'butt' : 'round'}
                  strokeDasharray={`${todayFrac * circumference} ${circumference}`}
                  style={{ transform: `rotate(${creditFrac * 360}deg)`, transformOrigin: '50% 50%' }}
                  className="transition-[stroke-dasharray,transform] duration-500 ease-out"
                />
              )}
            </svg>
            <div className="absolute flex flex-col items-center">
              {/* One number: everything counted toward the target (walked today + any credit carried in). */}
              <span className="text-2xl font-extrabold tracking-tight text-lime-700 dark:text-lime-400">{displaySteps.toLocaleString()}</span>
              <span className="text-[10px] text-zinc-600 dark:text-zinc-500">{displayGoal > 0 ? `מתוך ${displayGoal.toLocaleString()}` : 'השבוע כבר הושלם'}</span>
            </div>
          </div>
          {hasCredit && (
            <p className="mt-2 whitespace-nowrap text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
              🟡 {boost.credited.toLocaleString()} מ{creditSource} • 🟢 {selectedSteps.toLocaleString()} {isToday ? 'היום' : dateLabel}
            </p>
          )}
        </div>

        <div className="flex w-full flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {percent >= 100 ? 'היעד הושג! 🎉' : `${percent}% מהיעד ${isWeekly ? 'להיום' : 'היומי'}`}
            </p>
            <button
              type="button"
              onClick={() => setIsEditingGoal(true)}
              aria-label="עריכת יעד צעדים"
              className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50"
            >
              {isWeekly ? `ממוצע: ${baseGoalSteps.toLocaleString()} ליום` : `יעד: ${displayGoal.toLocaleString()}`}
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          {metGoal && (
            <div className="-mt-1 flex flex-col items-start gap-1">
              <p className="rounded-md bg-lime-400 px-2.5 py-1 text-xs font-extrabold text-zinc-950">יעד הושלם בהצלחה! 🏆</p>
              {carried && (
                <p className="text-[11px] font-semibold text-lime-700 dark:text-lime-400">
                  +{carried.steps.toLocaleString()} צעדי בונוס נזקפו והועברו ל{describeDate(carried.toDate, today)}
                </p>
              )}
            </div>
          )}
          {boost.active && boost.net === 0 && (
            <p className="-mt-1.5 self-start rounded-md bg-lime-400/20 px-2 py-1 text-[11px] font-bold text-lime-800 dark:text-lime-300">
              החריגה כוסתה ע״י צעדי {boost.creditFromYesterdayOnly ? 'אתמול' : 'הימים הקודמים'}! 🏆
            </p>
          )}
          {boost.active && boost.net > 0 && (
            <p className="-mt-1.5 self-start rounded-md bg-lime-400/10 px-2 py-1 text-[11px] font-semibold text-lime-700 dark:text-lime-400">
              מותאם (+{boost.net.toLocaleString()} לאיזון
              {boost.credited > 0 && ` • קוזזו ${boost.credited.toLocaleString()} מ${boost.creditFromYesterdayOnly ? 'אתמול' : 'הימים הקודמים'}`}) ⚖️
            </p>
          )}
          {!boost.active && tomorrowBoost?.active && tomorrowBoost.net > 0 && (
            <p className="-mt-1.5 self-start rounded-md bg-lime-400/10 px-2 py-1 text-[11px] font-semibold text-lime-700 dark:text-lime-400">
              מחר: יעד מותאם (+{tomorrowBoost.net.toLocaleString()} לאיזון
              {tomorrowBoost.credited > 0 && ` • קוזזו ${tomorrowBoost.credited.toLocaleString()}`}) ⚖️
            </p>
          )}

          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-lime-400 transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>

          <StepsSummary weekly={isWeekly ? weekly : null} mode={stepMode} weightKg={weightKg} baseGoal={baseGoalSteps} stepsOnDay={selectedSteps} isToday={isToday} bankKcal={bankKcal} onClearRebalanceSteps={onClearRebalanceSteps} />

          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-500">
            <Flame className="h-3.5 w-3.5 text-orange-700 dark:text-orange-400" />
            נשרפו כ-{caloriesBurned} קק״ל מהליכה {isToday ? 'היום' : dateLabel}
          </div>

          <button type="button" onClick={() => setIsLogging(true)} className="btn-primary">
            {isToday ? 'עדכן צעדים 👟' : `ערוך צעדים - ${dateLabel} ✏️`}
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-500">7 הימים האחרונים - לחצו על יום כדי לראות או לתקן את הצעדים שלו</p>
        <div className="flex items-end justify-between gap-1.5">
          {last7Days.map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelectedDate(d.date)}
              aria-label={`צעדים ב${describeDate(d.date, today)}: ${d.steps.toLocaleString()}`}
              aria-pressed={d.date === selectedDate}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg p-1 transition ${
                d.date === selectedDate ? 'bg-lime-400/10 ring-1 ring-lime-400/50' : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              <span className="text-[9px] font-semibold tabular-nums text-zinc-500 dark:text-zinc-500">
                {d.steps > 0 ? (d.steps >= 1000 ? `${(d.steps / 1000).toFixed(1)}k` : d.steps) : '-'}
              </span>
              <div className="flex h-14 w-full items-end overflow-hidden rounded bg-white dark:bg-zinc-900">
                <div
                  className={`w-full rounded-t transition-all ${d.steps >= d.goal && d.steps > 0 ? 'bg-lime-400' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                  style={{ height: d.steps > 0 ? `${Math.max((d.steps / historyMax) * 100, 6)}%` : '0%' }}
                />
              </div>
              <span className="text-[9px] text-zinc-500 dark:text-zinc-600">{WEEKDAY_LETTERS[d.weekday]}</span>
            </button>
          ))}
        </div>
      </div>

      {isLogging && (
        <QuickStepsModal
          dateLabel={dateLabel}
          currentSteps={selectedSteps}
          onSave={(steps) => {
            onSaveSteps(selectedDate, steps);
            setIsLogging(false);
            setToastMessage(isToday ? 'הצעדים עודכנו' : `הצעדים של ${dateLabel} עודכנו`);
          }}
          onClose={() => setIsLogging(false)}
        />
      )}

      {isEditingGoal && (
        <StepGoalModal
          goal={baseGoalSteps}
          mode={goalMode}
          onSave={(goal, mode) => {
            onSaveGoal(goal, mode);
            setIsEditingGoal(false);
            setToastMessage('יעד הצעדים עודכן');
          }}
          onClose={() => setIsEditingGoal(false)}
        />
      )}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </div>
  );
}

/** What the steps mean, in two short lines: the average since Sunday and what each remaining day needs, or, in the calorie mode, what today's steps added. */
function StepsSummary({
  weekly,
  mode,
  weightKg,
  baseGoal,
  stepsOnDay,
  isToday,
  bankKcal,
  onClearRebalanceSteps,
}: {
  weekly: ReturnType<typeof getWeeklyStepsPlan> | null;
  mode: StepMode;
  weightKg: number;
  baseGoal: number;
  stepsOnDay: number;
  isToday: boolean;
  bankKcal: number;
  onClearRebalanceSteps?: () => void;
}) {
  const fmt = (n: number) => n.toLocaleString('he-IL');
  const bonus = stepBonusKcal(stepsOnDay, baseGoal, weightKg);
  const dayWord = isToday ? 'היום' : 'ביום הזה';

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3">
      {weekly && weekly.averageBefore !== null && (
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          ממוצע עד {isToday ? 'אתמול' : 'אז'}: <span className="tabular-nums">{fmt(weekly.averageBefore)}</span> ליום
          <span className="font-normal text-zinc-500"> · יעד {fmt(baseGoal)}</span>
        </p>
      )}
      {mode === 'balance_steps' && weekly && (
        <>
          <p className="mt-1 text-xs font-bold text-lime-700 dark:text-lime-400">
            {weekly.stepsNeeded === 0
              ? 'יעד השבוע הושג 🎉 כל צעד נוסף הוא בונוס'
              : weekly.daysRemaining === 1
                ? `${isToday ? 'היום האחרון בשבוע' : 'היום האחרון'}: ${fmt(weekly.targetForTodayAndRemaining)} צעדים כדי לעמוד בממוצע השבועי`
                : `נשארו ${weekly.daysRemaining} ימים${isToday ? ' (כולל היום)' : ''}: ${fmt(weekly.targetForTodayAndRemaining)} צעדים ביום כדי לעמוד בממוצע השבועי`}
          </p>
          {weekly.stepsNeeded > 0 && stepsOnDay > 0 && (
            <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
              {weekly.leftToday === 0 ? `${isToday ? 'להיום' : 'ליום הזה'} הושלם היעד` : `נשארו ${isToday ? 'להיום' : 'ליום הזה'}: ${fmt(weekly.leftToday)} צעדים`}
            </p>
          )}
          {weekly.weeklyTarget > weekly.targetDailySteps * 7 && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              כולל {fmt(weekly.weeklyTarget - weekly.targetDailySteps * 7)} צעדים שהוספת כדי לפצות על חריגה בקלוריות.
              {onClearRebalanceSteps && (
                <>
                  {' '}
                  <button type="button" onClick={onClearRebalanceSteps} className="font-semibold underline">
                    ביטול
                  </button>
                </>
              )}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-zinc-500">תקציב הקלוריות להיום רגיל: יעד הבסיס, בלי תוספת מצעדים.</p>
        </>
      )}
      {mode === 'add_calories' && (
        <>
          <p className="mt-1 text-sm font-extrabold text-lime-700 dark:text-lime-400">יתרת בנק קלוריות: +{fmt(bankKcal)} קק״ל</p>
          <p className="mt-0.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
            {bonus > 0 ? `${dayWord}: ${fmt(stepsOnDay - baseGoal)} צעדים מעל היעד = +${fmt(bonus)} קק״ל` : `צעדים מעל ${fmt(baseGoal)} ${dayWord} יצטרפו לבנק`}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            יעד הצעדים היומי נשאר {fmt(baseGoal)}. תקציב הקלוריות להיום כולל את הבנק, וקלוריות שלא נוצלו מתגלגלות לימים הבאים באותו שבוע.
          </p>
        </>
      )}
    </div>
  );
}

/** Two clear choices, one active: the steps above the goal lower what the coming days need, or they become calories on the same day. Never both. */
function StepModeToggle({ mode, onChange }: { mode: StepMode; onChange: (mode: StepMode) => void }) {
  const options: { value: StepMode; label: string; hint: string }[] = [
    { value: 'balance_steps', label: 'איזון צעדים', hint: 'עודף צעדים מוריד את היעד לימים הבאים' },
    { value: 'add_calories', label: 'תוספת קלוריות', hint: 'עודף צעדים מתווסף לקלוריות' },
  ];
  return (
    <div role="radiogroup" aria-label="מה עושים עם עודף צעדים" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
      {options.map((o) => {
        const selected = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`flex flex-col items-center rounded-xl px-2 py-2 text-center transition-all duration-200 active:scale-[0.97] ${
              selected ? 'bg-lime-400 text-zinc-950 shadow-[0_4px_14px_-6px_rgba(163,230,53,0.8)]' : 'text-zinc-600 hover:bg-white/60 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <span className="text-sm font-extrabold">{o.label}</span>
            <span className={`text-[10px] leading-tight ${selected ? 'text-zinc-800' : 'text-zinc-500'}`}>{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
