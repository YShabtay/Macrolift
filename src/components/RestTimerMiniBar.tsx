import { createPortal } from 'react-dom';
import { Dumbbell, Timer, X } from 'lucide-react';
import { useRestTimer } from '../context/restTimerContext';

interface RestTimerMiniBarProps {
  /** Brings the user back to the workout screen. */
  onOpenWorkout: () => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Compact floating bar above the bottom navigation that keeps an active rest visible while the user is
 * on any screen other than the workout one. Tapping the bar returns to the workout.
 */
export default function RestTimerMiniBar({ onOpenWorkout }: RestTimerMiniBarProps) {
  const { status, label, remainingSec, addSeconds, cancel } = useRestTimer();
  const isDone = status === 'finished';
  const isPaused = status === 'paused';

  return createPortal(
    <div
      role="status"
      onClick={onOpenWorkout}
      className={`fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md cursor-pointer items-center justify-between gap-2 rounded-2xl border p-3 shadow-2xl backdrop-blur animate-slide-up md:bottom-6 md:end-6 md:start-auto md:mx-0 md:w-96 ${
        isDone ? 'border-lime-400/70 bg-zinc-900/95 animate-glow-pulse' : 'border-zinc-800 bg-zinc-900/95'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Timer className={`h-5 w-5 shrink-0 text-lime-400 ${status === 'running' ? 'animate-pulse' : ''}`} />
        <div className="min-w-0">
          <p className="text-sm font-extrabold tabular-nums text-zinc-100">
            {isDone ? 'המנוחה הסתיימה!' : `${isPaused ? 'מנוחה מושהית' : 'מנוחה פעילה'}: ${formatTime(remainingSec)}`}
          </p>
          {label && <p className="truncate text-[11px] text-zinc-400">{label}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => addSeconds(30)}
          aria-label="הוסף 30 שניות"
          className="h-9 rounded-full border border-lime-400/40 bg-lime-400/10 px-3 text-xs font-bold text-lime-400 transition hover:bg-lime-400/20 active:scale-95"
        >
          +30s
        </button>
        <button
          type="button"
          onClick={onOpenWorkout}
          aria-label="חזרה לאימון"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-400 active:scale-90"
        >
          <Dumbbell className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label="עצירה וביטול הטיימר"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:border-red-400/50 hover:text-red-400 active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
