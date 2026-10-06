import { Check } from 'lucide-react';
import { formatMacro } from '../utils/formatMacro';

interface BalancedRingProps {
  eaten: number;
  target: number;
  /** Size classes, e.g. "h-36 w-36". */
  className?: string;
}

/** The calorie ring for a day that went over its target but is already made up for: a full green ring with a check mark instead of a warning. */
export default function BalancedRing({ eaten, target, className = 'h-36 w-36' }: BalancedRingProps) {
  return (
    <div className={`relative flex shrink-0 items-center justify-center ${className}`} role="img" aria-label="מאוזן">
      <svg viewBox="0 0 120 120" className="h-full w-full">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#a3e635" strokeWidth="10" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Check className="h-7 w-7 text-lime-700 dark:text-lime-400" strokeWidth={3} />
        <span className="mt-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">מאוזן</span>
        <span className="mt-0.5 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-600">
          {formatMacro(eaten)}/{formatMacro(target)}
        </span>
      </div>
    </div>
  );
}
