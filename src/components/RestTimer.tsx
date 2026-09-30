import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { fireRestTimerFinishedAlert, unlockRestTimerAudio } from '../utils/restTimerAlert';

interface RestTimerProps {
  seconds: number;
  label: string;
  onDismiss: () => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Floating rest-timer widget. Mount with a fresh `key` per rest session so
 * internal state (remaining time, running/paused) resets cleanly.
 */
export default function RestTimer({ seconds, label, onDismiss }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const id = setTimeout(() => setRemaining((r) => Math.max(r - 1, 0)), 1000);
    return () => clearTimeout(id);
  }, [running, remaining]);

  useEffect(() => {
    if (remaining > 0) {
      hasFinishedRef.current = false;
      return;
    }
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    fireRestTimerFinishedAlert();
  }, [remaining]);

  const progress = seconds > 0 ? remaining / seconds : 0;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const isDone = remaining <= 0;

  return createPortal(
    <div className="fixed inset-x-4 bottom-24 z-40 flex justify-center sm:inset-x-auto sm:bottom-6 sm:end-6 sm:justify-end animate-slide-up">
      <div
        className={`glass-card neon-border flex w-full max-w-sm items-center gap-4 p-3 shadow-glow sm:w-80 ${isDone ? 'animate-glow-pulse' : ''}`}
      >
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-zinc-200 dark:text-zinc-800" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={isDone ? 'text-lime-700 dark:text-lime-400' : 'text-lime-700 dark:text-lime-400 transition-[stroke-dashoffset] duration-1000 ease-linear'}
            />
          </svg>
          <span className={`absolute text-sm font-bold tabular-nums ${isDone ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {formatTime(remaining)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-500">{isDone ? 'המנוחה הסתיימה' : 'מנוחה'}</p>
          <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{label}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              unlockRestTimerAudio();
              setRunning((r) => !r);
            }}
            aria-label={running ? 'השהיה' : 'המשך'}
            disabled={isDone}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400 active:scale-90 disabled:opacity-40"
          >
            {running ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setRemaining(seconds);
              setRunning(true);
            }}
            aria-label="איפוס"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400 active:scale-90"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="דילוג"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 transition hover:border-red-400/50 hover:text-red-400 active:scale-90"
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
