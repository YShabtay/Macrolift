import { Droplets, Minus, Plus } from 'lucide-react';
import { GLASS_ML } from '../utils/water';

interface WaterTrackerProps {
  ml: number;
  goalMl: number;
  /** Adds (positive) or removes (negative) millilitres for the viewed day. */
  onAdd: (deltaMl: number) => void;
}

/** Daily water: one tap per glass, a row of glasses that fill up toward the goal. */
export default function WaterTracker({ ml, goalMl, onAdd }: WaterTrackerProps) {
  const goalGlasses = Math.max(Math.round(goalMl / GLASS_ML), 1);
  const filledGlasses = Math.floor(ml / GLASS_ML);
  const shownGlasses = Math.max(goalGlasses, filledGlasses);
  const isDone = ml >= goalMl;

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">מים</h3>
        </div>
        <p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {(ml / 1000).toLocaleString('he-IL', { maximumFractionDigits: 2 })}
          <span className="font-medium text-zinc-500"> / {(goalMl / 1000).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ליטר</span>
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="img" aria-label={`${filledGlasses} כוסות מתוך ${goalGlasses}`}>
        {Array.from({ length: shownGlasses }).map((_, i) => (
          <span
            key={i}
            className={`h-6 w-5 rounded-b-md rounded-t-sm border transition-colors ${
              i < filledGlasses ? 'border-sky-400 bg-sky-400' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onAdd(GLASS_ML)} className="btn-primary flex-1 py-2.5 text-sm">
          <Plus className="h-4 w-4" />
          כוס ({GLASS_ML} מ״ל)
        </button>
        <button type="button" onClick={() => onAdd(500)} className="btn-secondary px-3 py-2.5 text-sm">
          +500
        </button>
        <button
          type="button"
          onClick={() => onAdd(-GLASS_ML)}
          disabled={ml <= 0}
          aria-label="הורדת כוס (תיקון)"
          className="btn-secondary px-3 py-2.5 text-sm disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
      {isDone && <p className="mt-2 text-xs font-semibold text-sky-700 dark:text-sky-400">יעד המים להיום הושג 💧</p>}
    </div>
  );
}
