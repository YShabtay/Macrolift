import { X } from 'lucide-react';
import Dumbbell from './DumbbellIcon';

interface WorkoutDayBannerProps {
  /** The workout's letter, e.g. "A". */
  letter: string;
  focus: string;
  onStart: () => void;
  onDismiss: () => void;
}

/** Morning nudge shown on the dashboard on a day with a planned, not-yet-done workout. */
export default function WorkoutDayBanner({ letter, focus, onStart, onDismiss }: WorkoutDayBannerProps) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl border border-lime-400/40 bg-lime-400/10 p-3.5 animate-fade-in">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-zinc-950">
        <Dumbbell className="h-5 w-5" />
      </span>
      <button type="button" onClick={onStart} className="min-w-0 flex-1 text-right">
        <p className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">היום מתוכנן אימון {letter}! מוכן להפציץ? 💪</p>
        <p className="truncate text-[11px] text-zinc-600 dark:text-zinc-400">{focus} · לחצו להתחלה</p>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="סגירת התזכורת להיום"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-lime-400/20 dark:text-zinc-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
