import { useState } from 'react';
import { Pause, Play, RotateCcw, Timer as TimerIcon } from 'lucide-react';
import { useCountdown, useStopwatch } from '../hooks/useCountdown';
import { fireRestTimerFinishedAlert, unlockRestTimerAudio } from '../utils/restTimerAlert';

const QUICK_DURATIONS = [60, 90, 120, 180];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Mode = 'countdown' | 'stopwatch';

/** Standalone rest timer / stopwatch widget for the workout screen (independent of the per-set auto-popup RestTimer). */
export default function RestTimerWidget() {
  const [mode, setMode] = useState<Mode>('countdown');
  const [duration, setDuration] = useState(90);
  const [justFinished, setJustFinished] = useState(false);

  // Both clocks derive their value from timestamps, so a locked screen or backgrounded app can't lose time.
  const countdown = useCountdown({
    durationSec: 90,
    onFinish: () => {
      fireRestTimerFinishedAlert();
      setJustFinished(true);
    },
  });
  const stopwatch = useStopwatch();

  const remaining = countdown.remaining;
  const elapsed = stopwatch.elapsed;
  const running = mode === 'countdown' ? countdown.running : stopwatch.running;

  function selectDuration(d: number) {
    // Tapping a duration is a user gesture: warm up audio now so the finish beeps are allowed later on iOS.
    unlockRestTimerAudio();
    setDuration(d);
    countdown.reset(d);
    setJustFinished(false);
  }

  function toggleRunning() {
    if (mode === 'countdown' && remaining <= 0) return;
    // Must run synchronously inside this click handler - iOS Safari only unlocks Web Audio
    // within a user gesture, not later when the countdown actually finishes.
    unlockRestTimerAudio();
    setJustFinished(false);
    const clock = mode === 'countdown' ? countdown : stopwatch;
    if (running) clock.pause();
    else clock.start();
  }

  function handleReset() {
    setJustFinished(false);
    if (mode === 'countdown') countdown.reset(duration);
    else stopwatch.reset();
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setJustFinished(false);
    countdown.reset(duration);
    stopwatch.reset();
  }

  const displaySeconds = mode === 'countdown' ? remaining : elapsed;
  const progress = mode === 'countdown' && duration > 0 ? remaining / duration : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div
      className={`glass-card p-5 transition sm:p-6 ${justFinished ? 'border-lime-400/60 shadow-glow animate-glow-pulse' : ''}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TimerIcon className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">טיימר מנוחה</h2>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => switchMode('countdown')}
            className={`px-3 py-1.5 transition ${mode === 'countdown' ? 'bg-lime-400 text-zinc-950' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
          >
            טיימר
          </button>
          <button
            type="button"
            onClick={() => switchMode('stopwatch')}
            className={`px-3 py-1.5 transition ${mode === 'stopwatch' ? 'bg-lime-400 text-zinc-950' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
          >
            סטופר
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          {mode === 'countdown' ? (
            <svg viewBox="0 0 80 80" className="h-28 w-28 -rotate-90">
              <circle cx="40" cy="40" r={radius} fill="none" className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="7" />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke="#a3e635"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>
          ) : (
            <div className={`flex h-28 w-28 items-center justify-center rounded-full border-4 ${running ? 'border-lime-400/50' : 'border-zinc-200 dark:border-zinc-800'}`} />
          )}
          <span className={`absolute text-2xl font-extrabold tabular-nums ${justFinished ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {formatTime(displaySeconds)}
          </span>
        </div>

        <div className="flex w-full flex-1 flex-col gap-3">
          {mode === 'countdown' && (
            <div className="grid grid-cols-4 gap-2">
              {QUICK_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => selectDuration(d)}
                  className={`rounded-lg border py-2 text-xs font-bold transition ${
                    duration === d
                      ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleRunning}
              disabled={mode === 'countdown' && remaining <= 0}
              className="btn-primary flex-1 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              {running ? 'השהיה' : 'הפעלה'}
            </button>
            <button type="button" onClick={handleReset} aria-label="איפוס" className="btn-secondary px-4 text-sm">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {justFinished && <p className="text-center text-xs font-semibold text-lime-700 dark:text-lime-400">הזמן נגמר! זמן לסט הבא 💪</p>}
        </div>
      </div>
    </div>
  );
}
