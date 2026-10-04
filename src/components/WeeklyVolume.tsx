import type { WorkoutPlan } from '../types/fitness';
import { getMuscleVolumes, MUSCLE_LABELS, type MuscleVolume } from '../utils/planVolume';

interface WeeklyVolumeProps {
  plan: Pick<WorkoutPlan, 'days'>;
  /** Extra classes for the wrapper. */
  className?: string;
}

const STATUS_STYLE: Record<MuscleVolume['status'], { bar: string; text: string; note: string }> = {
  'in-range': { bar: 'bg-lime-400', text: 'text-lime-700 dark:text-lime-400', note: 'בטווח' },
  below: { bar: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', note: 'מתחת לטווח' },
  above: { bar: 'bg-orange-400', text: 'text-orange-700 dark:text-orange-400', note: 'מעל הטווח' },
  none: { bar: 'bg-zinc-400', text: 'text-zinc-600 dark:text-zinc-400', note: '' },
};

/** Sets per muscle in one week of the plan, against the range the app's programs aim for - shows at a glance what a plan over- or under-trains. */
export default function WeeklyVolume({ plan, className = '' }: WeeklyVolumeProps) {
  const rows = getMuscleVolumes(plan);
  const scaleMax = Math.max(...rows.map((r) => Math.max(r.sets, r.target?.max ?? 0)), 1) * 1.15;

  return (
    <div className={className}>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const style = STATUS_STYLE[row.status];
          return (
            <li key={row.muscle} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{MUSCLE_LABELS[row.muscle]}</span>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true">
                {row.target && (
                  <div
                    className="absolute inset-y-0 bg-zinc-400/30 dark:bg-zinc-500/30"
                    style={{ right: `${(row.target.min / scaleMax) * 100}%`, width: `${((row.target.max - row.target.min) / scaleMax) * 100}%` }}
                  />
                )}
                <div className={`absolute inset-y-0 right-0 rounded-full ${style.bar}`} style={{ width: `${Math.min((row.sets / scaleMax) * 100, 100)}%` }} />
              </div>
              <span className={`min-w-[5.5rem] text-left font-bold tabular-nums ${style.text}`}>
                {row.sets}
                {row.target && <span className="font-medium text-zinc-500 dark:text-zinc-500"> / {row.target.min}-{row.target.max}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
        סטים בשבוע לכל שריר מול הטווח המקובל (הפס האפור). שרירים קטנים מקבלים עבודה גם מהתרגילים הגדולים, ולכן הטווח שלהם נמוך יותר.
      </p>
    </div>
  );
}
