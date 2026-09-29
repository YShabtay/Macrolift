import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Dumbbell, Edit3, Moon, RotateCcw, X } from 'lucide-react';
import type { SetProgressEntry, WorkoutPlan, WorkoutScheduleEntry } from '../types/fitness';
import {
  buildMonthGrid,
  buildWeekGrid,
  CUSTOM_DAY_ID,
  isDayCompleted,
  REST_DAY_ID,
  type CalendarDay,
} from '../utils/scheduleHelpers';
import { formatDateDisplay, parseIsoDate, todayIso } from '../utils/weightCalculations';

interface WorkoutCalendarProps {
  workoutPlan: WorkoutPlan;
  progress: SetProgressEntry[];
  schedule: WorkoutScheduleEntry[];
  onSetSchedule: (date: string, dayId: string, customLabel?: string) => void;
  onClearSchedule: (date: string) => void;
  onQuickCompleteDay: (dayId: string, date?: string) => void;
  onUndoCompleteDay: (dayId: string, date?: string) => void;
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const WEEKDAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function scheduleLabel(entry: WorkoutScheduleEntry | undefined, workoutPlan: WorkoutPlan): string | null {
  if (!entry) return null;
  if (entry.dayId === REST_DAY_ID) return 'מנוחה';
  if (entry.dayId === CUSTOM_DAY_ID) return entry.customLabel || 'מותאם';
  return workoutPlan.days.find((d) => d.id === entry.dayId)?.dayLabel ?? null;
}

export default function WorkoutCalendar({
  workoutPlan,
  progress,
  schedule,
  onSetSchedule,
  onClearSchedule,
  onQuickCompleteDay,
  onUndoCompleteDay,
}: WorkoutCalendarProps) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [anchorDate, setAnchorDate] = useState(() => parseIsoDate(todayIso()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthDays = useMemo(
    () => buildMonthGrid(anchorDate.getFullYear(), anchorDate.getMonth(), workoutPlan, progress, schedule),
    [anchorDate, workoutPlan, progress, schedule],
  );
  const weekDays = useMemo(
    () => buildWeekGrid(formatDateForKey(anchorDate), workoutPlan, progress, schedule),
    [anchorDate, workoutPlan, progress, schedule],
  );

  const days = viewMode === 'month' ? monthDays : weekDays;

  function shiftAnchor(amount: number) {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') next.setMonth(next.getMonth() + amount);
      else next.setDate(next.getDate() + amount * 7);
      return next;
    });
  }

  const selectedEntry = selectedDate ? schedule.find((s) => s.date === selectedDate) : undefined;
  const selectedIsCompleted = selectedDate ? isDayCompleted(workoutPlan, progress, selectedDate) : false;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">לוח שנה ותכנון אימונים</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">שבצו את התוכנית שלכם לאורך השבוע ועקבו אחרי מה שכבר בוצע</p>
      </div>

      <div className="glass-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftAnchor(1)}
              aria-label="הבא"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => shiftAnchor(-1)}
              aria-label="הקודם"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {HEBREW_MONTHS[anchorDate.getMonth()]} {anchorDate.getFullYear()}
          </h2>

          <div className="flex gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'month' ? 'bg-lime-400 text-zinc-950' : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              חודש
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'week' ? 'bg-lime-400 text-zinc-950' : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              שבוע
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-zinc-600 dark:text-zinc-500 sm:gap-2">
          {WEEKDAY_LETTERS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((day) => (
            <DayCell key={day.date} day={day} workoutPlan={workoutPlan} onClick={() => setSelectedDate(day.date)} />
          ))}
        </div>
      </div>

      {selectedDate &&
        createPortal(
          <SchedulerModal
            date={selectedDate}
            workoutPlan={workoutPlan}
            currentEntry={selectedEntry}
            isCompleted={selectedIsCompleted}
            onSetSchedule={onSetSchedule}
            onClearSchedule={onClearSchedule}
            onQuickCompleteDay={onQuickCompleteDay}
            onUndoCompleteDay={onUndoCompleteDay}
            onClose={() => setSelectedDate(null)}
          />,
          document.body,
        )}
    </div>
  );
}

function formatDateForKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function DayCell({
  day,
  workoutPlan,
  onClick,
}: {
  day: CalendarDay;
  workoutPlan: WorkoutPlan;
  onClick: () => void;
}) {
  const label = scheduleLabel(day.scheduled, workoutPlan);
  const isRest = day.scheduled?.dayId === REST_DAY_ID;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-center transition sm:aspect-[4/3] ${
        !day.isCurrentMonth
          ? 'border-transparent text-zinc-300 dark:text-zinc-700'
          : day.isToday
            ? 'border-lime-400/60 bg-lime-400/5'
            : 'border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      <span className={`text-xs font-bold sm:text-sm ${day.isCurrentMonth ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-300 dark:text-zinc-700'}`}>
        {day.dayOfMonth}
      </span>

      {day.isCompleted ? (
        <span className="flex items-center gap-0.5 rounded-full bg-lime-400/15 px-1 py-0.5 text-lime-700 dark:text-lime-400">
          <Dumbbell className="h-2.5 w-2.5" />
        </span>
      ) : isRest ? (
        <Moon className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-600" />
      ) : label ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 sm:hidden" />
          <span className="hidden max-w-full truncate text-[9px] text-zinc-600 dark:text-zinc-500 sm:block">{label}</span>
        </>
      ) : (
        <span className="h-1.5 w-1.5 sm:hidden" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Scheduler popover
// ---------------------------------------------------------------------------

function SchedulerModal({
  date,
  workoutPlan,
  currentEntry,
  isCompleted,
  onSetSchedule,
  onClearSchedule,
  onQuickCompleteDay,
  onUndoCompleteDay,
  onClose,
}: {
  date: string;
  workoutPlan: WorkoutPlan;
  currentEntry: WorkoutScheduleEntry | undefined;
  isCompleted: boolean;
  onSetSchedule: (date: string, dayId: string, customLabel?: string) => void;
  onClearSchedule: (date: string) => void;
  onQuickCompleteDay: (dayId: string, date?: string) => void;
  onUndoCompleteDay: (dayId: string, date?: string) => void;
  onClose: () => void;
}) {
  // Selecting an option only stages it locally - nothing is saved until "אישור שיבוץ" is pressed.
  const [stagedDayId, setStagedDayId] = useState<string | null>(currentEntry?.dayId ?? null);
  const [customLabel, setCustomLabel] = useState(currentEntry?.customLabel ?? '');

  const showCustomInput = stagedDayId === CUSTOM_DAY_ID;
  const isRealPlanDay =
    !!currentEntry && currentEntry.dayId !== REST_DAY_ID && currentEntry.dayId !== CUSTOM_DAY_ID;

  function handleConfirm() {
    if (!stagedDayId) return;
    onSetSchedule(date, stagedDayId, stagedDayId === CUSTOM_DAY_ID ? customLabel.trim() || 'אימון מותאם' : undefined);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[85vh] w-full max-w-sm flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">שיבוץ ל-{formatDateDisplay(date)}</h3>
          <button type="button" onClick={onClose} aria-label="ביטול וסגירה" className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2 p-4">
          {workoutPlan.days.map((day) => {
            const selected = stagedDayId === day.id;
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => setStagedDayId(day.id)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-right transition ${
                  selected
                    ? 'border-lime-400/50 bg-lime-400/10'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <Dumbbell className={`h-4 w-4 shrink-0 ${selected ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-600 dark:text-zinc-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${selected ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{day.dayLabel}</p>
                  <p className="truncate text-xs text-zinc-600 dark:text-zinc-500">{day.focus}</p>
                </div>
                {selected && <Check className="h-4 w-4 shrink-0 text-lime-700 dark:text-lime-400" />}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setStagedDayId(REST_DAY_ID)}
            className={`flex items-center gap-3 rounded-xl border p-3 text-right transition ${
              stagedDayId === REST_DAY_ID
                ? 'border-lime-400/50 bg-lime-400/10'
                : 'border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <Moon className={`h-4 w-4 shrink-0 ${stagedDayId === REST_DAY_ID ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-600 dark:text-zinc-500'}`} />
            <span className={`text-sm font-bold ${stagedDayId === REST_DAY_ID ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
              יום מנוחה
            </span>
            {stagedDayId === REST_DAY_ID && <Check className="mr-auto h-4 w-4 text-lime-700 dark:text-lime-400" />}
          </button>

          <button
            type="button"
            onClick={() => setStagedDayId(CUSTOM_DAY_ID)}
            className={`flex items-center gap-3 rounded-xl border p-3 text-right transition ${
              showCustomInput
                ? 'border-lime-400/50 bg-lime-400/10'
                : 'border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <Edit3 className={`h-4 w-4 shrink-0 ${showCustomInput ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-600 dark:text-zinc-500'}`} />
            <span className={`text-sm font-bold ${showCustomInput ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
              אימון מותאם
            </span>
            {showCustomInput && <Check className="mr-auto h-4 w-4 text-lime-700 dark:text-lime-400" />}
          </button>

          {showCustomInput && (
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="לדוגמה: ריצה, שחייה..."
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400 animate-fade-in"
            />
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-200 dark:border-zinc-800 p-4">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!stagedDayId}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            אישור שיבוץ
          </button>

          {isRealPlanDay && (
            <button
              type="button"
              onClick={() =>
                isCompleted ? onUndoCompleteDay(currentEntry!.dayId, date) : onQuickCompleteDay(currentEntry!.dayId, date)
              }
              className={
                isCompleted
                  ? 'flex items-center justify-center gap-2 rounded-xl border border-lime-400/40 bg-lime-400/10 px-4 py-2.5 text-sm font-bold text-lime-700 dark:text-lime-400 transition hover:border-orange-400/40 hover:bg-orange-400/5 hover:text-orange-700 dark:hover:text-orange-400'
                  : 'btn-secondary'
              }
            >
              {isCompleted ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {isCompleted ? 'האימון סומן כהושלם - לחץ לביטול' : 'סמן/י יום זה כהושלם'}
            </button>
          )}
          {currentEntry && (
            <button
              type="button"
              onClick={() => {
                onClearSchedule(date);
                onClose();
              }}
              className="btn-secondary text-red-400 hover:border-red-500/40 hover:bg-red-500/5"
            >
              <X className="h-4 w-4" />
              נקה שיבוץ מיום זה
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
