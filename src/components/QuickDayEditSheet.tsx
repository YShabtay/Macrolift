import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CalendarPlus, Check, Moon, RotateCcw, X } from 'lucide-react';
import Dumbbell from './DumbbellIcon';
import type { SetProgressEntry, WorkoutPlan, WorkoutScheduleEntry } from '../types/fitness';
import { CUSTOM_DAY_ID, getScheduleForDate, isDayCompleted, REST_DAY_ID, workoutLetter } from '../utils/scheduleHelpers';
import { shareWorkoutReminder } from '../utils/calendarExport';
import { formatDateLong, parseIsoDate, todayIso } from '../utils/weightCalculations';

const WORKOUT_EMOJIS = ['💪', '🏋️'];

const WEEKDAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'];

interface QuickDayEditSheetProps {
  date: string;
  workoutPlan: WorkoutPlan;
  progress: SetProgressEntry[];
  schedule: WorkoutScheduleEntry[];
  /** Dates marked as trained (survives program switches); counted alongside per-set progress. */
  completedDates: readonly string[];
  onQuickCompleteDay: (dayId: string, date?: string) => void;
  onUndoCompleteDay: (dayId: string, date?: string) => void;
  onSetSchedule: (date: string, dayId: string, customLabel?: string) => void;
  onOpenFull: () => void;
  onClose: () => void;
}

/**
 * One-tap editing of a single day from the dashboard's week strip: mark/unmark it done, make it a
 * rest day, or switch which workout it is. Everything reads from and writes to the shared app state,
 * so the dashboard's metrics update the instant a button is pressed.
 */
export default function QuickDayEditSheet({
  date,
  workoutPlan,
  progress,
  schedule,
  completedDates,
  onQuickCompleteDay,
  onUndoCompleteDay,
  onSetSchedule,
  onOpenFull,
  onClose,
}: QuickDayEditSheetProps) {
  const [isChangingType, setIsChangingType] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  const entry = getScheduleForDate(schedule, date);
  const scheduledDay =
    entry && entry.dayId !== REST_DAY_ID && entry.dayId !== CUSTOM_DAY_ID
      ? workoutPlan.days.find((d) => d.id === entry.dayId)
      : undefined;
  const isRest = entry?.dayId === REST_DAY_ID;
  const completedDayIds = workoutPlan.days.filter((d) => isDayCompleted(workoutPlan, progress, date, d.id)).map((d) => d.id);
  const isCompleted = completedDayIds.length > 0 || completedDates.includes(date);
  const isToday = date === todayIso();

  const workoutTitle = scheduledDay
    ? `אימון ${workoutLetter(workoutPlan.splitType, workoutPlan.days.indexOf(scheduledDay))} - MacroLift`
    : '';
  const canRemind = !!scheduledDay && !isCompleted && date >= todayIso();

  async function handleSyncReminder() {
    if (!scheduledDay) return;
    const done = await shareWorkoutReminder({ date, title: workoutTitle, description: scheduledDay.focus, alarmHour: 9 });
    if (done) setReminderSent(true);
  }

  function undoAllCompletions() {
    if (completedDayIds.length > 0) completedDayIds.forEach((dayId) => onUndoCompleteDay(dayId, date));
    // A date marked completed under a previous program has no per-set records to undo - drop the mark itself.
    else onUndoCompleteDay('', date);
  }

  function handleToggleComplete() {
    if (isCompleted) undoAllCompletions();
    else if (scheduledDay) onQuickCompleteDay(scheduledDay.id, date);
  }

  function handleSetRest() {
    // A rest day can't also be a completed workout - clear the completion so every metric stays consistent.
    undoAllCompletions();
    onSetSchedule(date, REST_DAY_ID);
    setIsChangingType(false);
  }

  function handlePickType(dayId: string) {
    if (completedDayIds.some((id) => id !== dayId)) undoAllCompletions();
    onSetSchedule(date, dayId);
    setIsChangingType(false);
  }

  const currentLabel = scheduledDay
    ? `אימון ${workoutLetter(workoutPlan.splitType, workoutPlan.days.indexOf(scheduledDay))} - ${scheduledDay.focus}`
    : isRest
      ? 'יום מנוחה'
      : entry?.dayId === CUSTOM_DAY_ID
        ? entry.customLabel || 'אימון מותאם'
        : 'לא מתוכנן אימון';

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/70 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-b-none p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-glow animate-slide-up sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">{WEEKDAY_NAMES[parseIsoDate(date).getDay()]}</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-500">{formatDateLong(date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-3.5 py-3">
          {isRest ? <Moon className="h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-400" /> : <Dumbbell className="h-4 w-4 shrink-0 text-lime-700 dark:text-lime-400" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{currentLabel}</p>
            {isCompleted && <p className="text-[11px] font-semibold text-lime-700 dark:text-lime-400">האימון סומן כהושלם</p>}
          </div>
        </div>

        {(scheduledDay || isCompleted) && (
          <button
            type="button"
            onClick={handleToggleComplete}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] ${
              isCompleted
                ? 'border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                : 'bg-lime-400 text-zinc-950 hover:bg-lime-500'
            }`}
          >
            {isCompleted ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {isCompleted ? 'בטל סימון' : `סמן שהתאמנתי ${isToday ? 'היום' : 'ביום זה'} (השלם אימון) ✓`}
          </button>
        )}

        {scheduledDay && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFull();
            }}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-lime-700 transition hover:text-lime-600 dark:text-lime-400"
          >
            צפה בתרגילים והפעל טיימר
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {canRemind && (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => void handleSyncReminder()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-lime-400/50"
            >
              <CalendarPlus className="h-4 w-4" />
              סנכרן תזכורת ליומן הטלפון 📅
            </button>
            <p className="text-[11px] leading-snug text-zinc-500">
              {reminderSent ? 'הקובץ מוכן - אשרו את ההוספה ליומן. התראה תופיע ב-09:00 ביום האימון.' : 'התראה ביומן ב-09:00 ביום האימון, ללא שרת.'}
            </p>
          </div>
        )}

        {/* Nothing planned yet (or switching): pick the day's workout straight from the active program, or make it a rest day. */}
        {(!scheduledDay && !isCompleted) || isChangingType || (isRest && !isCompleted) ? (
          <div className="flex flex-col gap-1.5 animate-fade-in">
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-500">
              {scheduledDay ? 'החלפת האימון ליום זה' : 'מה מתכננים ליום הזה?'}
            </p>
            {workoutPlan.days.map((day, index) => (
              <button
                key={day.id}
                type="button"
                onClick={() => handlePickType(day.id)}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-right text-sm transition active:scale-[0.99] ${
                  scheduledDay?.id === day.id
                    ? 'border-lime-400/50 bg-lime-400/10'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:border-lime-400/40'
                }`}
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {WORKOUT_EMOJIS[index % WORKOUT_EMOJIS.length]} אימון {workoutLetter(workoutPlan.splitType, index)}{' '}
                  <span className="font-normal text-zinc-600 dark:text-zinc-400">- {day.focus}</span>
                </span>
                {scheduledDay?.id === day.id && <Check className="h-4 w-4 shrink-0 text-lime-700 dark:text-lime-400" />}
              </button>
            ))}
            {!isRest && (
              <button
                type="button"
                onClick={handleSetRest}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-3.5 py-3 text-right text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 dark:text-zinc-300"
              >
                🌙 קבע כיום מנוחה
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            {!isRest && !isCompleted && (
              <button type="button" onClick={handleSetRest} className="btn-secondary flex-1 py-3 text-sm">
                <Moon className="h-4 w-4" />
                קבע כיום מנוחה
              </button>
            )}
            {!isCompleted && (
              <button type="button" onClick={() => setIsChangingType(true)} className="btn-secondary flex-1 py-3 text-sm">
                שנה סוג אימון
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
