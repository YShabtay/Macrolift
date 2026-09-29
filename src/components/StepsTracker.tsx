import { useMemo, useState } from 'react';
import { Flame, Footprints, Play, Square } from 'lucide-react';
import type { StepLog } from '../types/fitness';
import { todayIso, parseIsoDate, formatIsoDate } from '../utils/weightCalculations';
import { estimateStepCalories, getStepsForDate } from '../utils/stepsCalculations';
import { useStepCounter } from '../hooks/useStepCounter';

interface StepsTrackerProps {
  stepLogs: StepLog[];
  goalSteps: number;
  weightKg: number;
  onSaveSteps: (date: string, steps: number) => void;
}

const WEEKDAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export default function StepsTracker({ stepLogs, goalSteps, weightKg, onSaveSteps }: StepsTrackerProps) {
  const today = todayIso();
  const todaySteps = useMemo(() => getStepsForDate(stepLogs, today), [stepLogs, today]);
  const [inputValue, setInputValue] = useState('');
  const counter = useStepCounter();

  const progress = goalSteps > 0 ? Math.min(todaySteps / goalSteps, 1) : 0;
  const caloriesBurned = estimateStepCalories(todaySteps, weightKg);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const last7Days = useMemo(() => {
    const days: { date: string; steps: number; weekday: number }[] = [];
    const base = parseIsoDate(today);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const key = formatIsoDate(d);
      days.push({ date: key, steps: getStepsForDate(stepLogs, key), weekday: d.getDay() });
    }
    return days;
  }, [stepLogs, today]);
  const historyMax = Math.max(...last7Days.map((d) => d.steps), goalSteps, 1);

  function handleQuickUpdate() {
    const n = Number(inputValue);
    if (!inputValue.trim() || Number.isNaN(n) || n < 0) return;
    onSaveSteps(today, Math.round(n));
    setInputValue('');
  }

  async function handleToggleLiveCounter() {
    if (counter.isActive) {
      const counted = counter.stop();
      if (counted > 0) onSaveSteps(today, todaySteps + counted);
    } else {
      await counter.start();
    }
  }

  return (
    <div className="glass-card p-5 transition hover:border-lime-400/30 hover:shadow-glow sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Footprints className="h-4 w-4 text-lime-700 dark:text-lime-400" />
        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">צעדים יומיים</h2>
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
            <span className="text-2xl font-extrabold tracking-tight text-lime-700 dark:text-lime-400">{todaySteps.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-600 dark:text-zinc-500">מתוך {goalSteps.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-500">
            <Flame className="h-3.5 w-3.5 text-orange-700 dark:text-orange-400" />
            נשרפו כ-{caloriesBurned} קק״ל מהליכה היום
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickUpdate()}
              placeholder="לדוגמה: 8500"
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
            />
            <button type="button" onClick={handleQuickUpdate} className="btn-primary px-4 text-xs">
              עדכון
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleLiveCounter}
            className={
              counter.isActive
                ? 'btn-secondary border-orange-400/40 text-orange-700 dark:text-orange-400 hover:border-orange-400/60'
                : 'btn-secondary'
            }
          >
            {counter.isActive ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-4 w-4" />}
            {counter.isActive ? `עצירה (${counter.liveSteps} צעדים נספרו)` : 'הפעל מונה צעדים להליכה כעת'}
          </button>

          {counter.error && <p className="text-[11px] text-orange-700 dark:text-orange-400">{counter.error}</p>}
          {!counter.isSupported && !counter.error && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-600">המונה בזמן אמת דורש חיישן תנועה וזמין בעיקר במכשירים ניידים.</p>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-500">7 הימים האחרונים</p>
        <div className="flex items-end justify-between gap-1.5">
          {last7Days.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end overflow-hidden rounded bg-white dark:bg-zinc-900">
                <div
                  className={`w-full rounded-t transition-all ${d.steps >= goalSteps && d.steps > 0 ? 'bg-lime-400' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                  style={{ height: d.steps > 0 ? `${Math.max((d.steps / historyMax) * 100, 6)}%` : '0%' }}
                />
              </div>
              <span className="text-[9px] text-zinc-500 dark:text-zinc-600">{WEEKDAY_LETTERS[d.weekday]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
