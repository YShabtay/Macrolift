import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, Footprints, Pencil } from 'lucide-react';
import type { StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { useToday } from '../hooks/useToday';
import { parseIsoDate, formatIsoDate, formatDateDisplay } from '../utils/weightCalculations';
import { estimateStepCalories, getStepsForDate } from '../utils/stepsCalculations';
import { getEffectiveStepGoal } from '../utils/weeklyBalance';
import { QuickStepsModal, StepGoalModal } from './StepsModals';
import Toast from './Toast';

interface StepsTrackerProps {
  stepLogs: StepLog[];
  /** The user's own daily goal, without any temporary weekly-rebalance boost - what the goal editor changes. */
  baseGoalSteps: number;
  /** Temporary weekly rebalance; adds extra steps to the goal on the days it covers. */
  weeklyBalance?: WeeklyBalanceAdjustment;
  weightKg: number;
  /** Saves (or overwrites) the step count of one date - works for today and for past days alike. */
  onSaveSteps: (date: string, steps: number) => void;
  onSaveGoal: (goal: number) => void;
}

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

export default function StepsTracker({ stepLogs, baseGoalSteps, weeklyBalance, weightKg, onSaveSteps, onSaveGoal }: StepsTrackerProps) {
  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const [isLogging, setIsLogging] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isToday = selectedDate === today;
  const dateLabel = describeDate(selectedDate, today);
  const selectedSteps = useMemo(() => getStepsForDate(stepLogs, selectedDate), [stepLogs, selectedDate]);

  // The goal that applies to the viewed day, including any temporary weekly-rebalance boost on that day.
  const goalSteps = getEffectiveStepGoal(baseGoalSteps, weeklyBalance, selectedDate);
  const stepBoost = goalSteps - baseGoalSteps;
  const tomorrowStepBoost = isToday ? getEffectiveStepGoal(baseGoalSteps, weeklyBalance, shiftDate(today, 1)) - baseGoalSteps : 0;

  const progress = goalSteps > 0 ? Math.min(selectedSteps / goalSteps, 1) : 0;
  const percent = goalSteps > 0 ? Math.round((selectedSteps / goalSteps) * 100) : 0;
  const caloriesBurned = estimateStepCalories(selectedSteps, weightKg);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const last7Days = useMemo(() => {
    const days: { date: string; steps: number; goal: number; weekday: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = shiftDate(today, -i);
      days.push({
        date: key,
        steps: getStepsForDate(stepLogs, key),
        goal: getEffectiveStepGoal(baseGoalSteps, weeklyBalance, key),
        weekday: parseIsoDate(key).getDay(),
      });
    }
    return days;
  }, [stepLogs, today, baseGoalSteps, weeklyBalance]);
  const historyMax = Math.max(...last7Days.map((d) => d.steps), goalSteps, 1);

  return (
    <div className="glass-card p-5 transition hover:border-lime-400/30 hover:shadow-glow sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Footprints className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">צעדים יומיים</h2>
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

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#a3e635"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-extrabold tracking-tight text-lime-700 dark:text-lime-400">{selectedSteps.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-600 dark:text-zinc-500">מתוך {goalSteps.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {percent >= 100 ? 'היעד הושג! 🎉' : `${percent}% מהיעד היומי`}
            </p>
            <button
              type="button"
              onClick={() => setIsEditingGoal(true)}
              aria-label="עריכת יעד צעדים"
              className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50"
            >
              יעד: {goalSteps.toLocaleString()}
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          {stepBoost === 0 && tomorrowStepBoost > 0 && (
            <p className="-mt-1.5 self-start rounded-md bg-lime-400/10 px-2 py-1 text-[11px] font-semibold text-lime-700 dark:text-lime-400">
              מחר: יעד מותאם (+{tomorrowStepBoost.toLocaleString()} לאיזון) ⚖️
            </p>
          )}
          {stepBoost > 0 && (
            <p className="-mt-1.5 self-start rounded-md bg-lime-400/10 px-2 py-1 text-[11px] font-semibold text-lime-700 dark:text-lime-400">
              מותאם שבועית (+{stepBoost.toLocaleString()} לאיזון) ⚖️
            </p>
          )}

          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-lime-400 transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>

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
          onSave={(goal) => {
            onSaveGoal(goal);
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
