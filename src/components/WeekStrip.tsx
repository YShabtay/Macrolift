import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDaysIso } from '../utils/dateMath';
import { getWeekStart } from '../utils/weightCalculations';

const WEEKDAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export interface WeekStripDay {
  /** Calories logged that day, or null when nothing was logged. */
  kcal: number | null;
  /** How the day went against its target. */
  status: 'on-target' | 'over' | 'under' | 'none';
}

interface WeekStripProps {
  selectedDate: string;
  today: string;
  /** Summary of each date of the shown week (Sunday first). */
  getDay: (date: string) => WeekStripDay;
  onSelect: (date: string) => void;
}

const DOT: Record<WeekStripDay['status'], string> = {
  'on-target': 'bg-lime-400',
  over: 'bg-orange-400',
  under: 'bg-sky-400',
  none: 'bg-transparent',
};

/** The seven days of the selected date's week with the calories logged on each, for jumping to any day (and any week) in one tap. */
export default function WeekStrip({ selectedDate, today, getDay, onSelect }: WeekStripProps) {
  const weekStart = getWeekStart(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
  const prevWeek = addDaysIso(weekStart, -7);
  const nextWeekStart = addDaysIso(weekStart, 7);
  const hasNextWeek = nextWeekStart <= today;

  return (
    <div className="flex items-center gap-1" role="group" aria-label="בחירת יום בשבוע">
      <button
        type="button"
        onClick={() => onSelect(prevWeek)}
        aria-label="השבוע הקודם"
        className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((date, i) => {
          const isFuture = date > today;
          const day = getDay(date);
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${WEEKDAY_LETTERS[i]} ${date.slice(8)}${day.kcal !== null ? `, ${day.kcal} קלוריות` : ', ללא תיעוד'}`}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-center transition disabled:opacity-30 ${
                isSelected ? 'bg-lime-400 text-zinc-950' : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              <span className={`text-[10px] font-semibold ${isSelected ? 'text-zinc-800' : 'text-zinc-500'}`}>{WEEKDAY_LETTERS[i]}</span>
              <span className={`text-sm font-extrabold tabular-nums ${isSelected ? '' : 'text-zinc-900 dark:text-zinc-100'}`}>{Number(date.slice(8))}</span>
              <span className={`text-[9px] font-semibold tabular-nums ${isSelected ? 'text-zinc-800' : 'text-zinc-500'}`}>{day.kcal !== null ? day.kcal : '-'}</span>
              <span aria-hidden="true" className={`h-1 w-1 rounded-full ${isSelected ? 'bg-zinc-900' : DOT[day.status]}`} />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSelect(nextWeekStart)}
        disabled={!hasNextWeek}
        aria-label="השבוע הבא"
        className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-200/60 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}
