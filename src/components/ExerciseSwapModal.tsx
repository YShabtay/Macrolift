import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, Info, X } from 'lucide-react';
import type { Equipment, Exercise, ExerciseAlternative, ExerciseDifficulty } from '../types/fitness';

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'מוט',
  dumbbell: 'משקולות יד',
  machine: 'מכונה',
  cable: 'פולי',
  bodyweight: 'משקל גוף',
  kettlebell: 'קטלבל',
};

const DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  beginner: 'למתחילים',
  intermediate: 'רמת ביניים',
  advanced: 'מתקדמים',
};

interface ExerciseSwapModalProps {
  exercise: Exercise | null;
  onClose: () => void;
  onSwap: (alternative: ExerciseAlternative) => void;
}

export default function ExerciseSwapModal({ exercise, onClose, onSwap }: ExerciseSwapModalProps) {
  useEffect(() => {
    if (!exercise) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [exercise, onClose]);

  if (!exercise) return null;

  const alternatives = exercise.alternatives ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <ArrowLeftRight className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">החלפת תרגיל</h3>
              <p className="truncate text-xs text-zinc-600 dark:text-zinc-500">{exercise.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="shrink-0 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-2 rounded-xl border border-lime-400/20 bg-lime-400/5 px-3 py-2.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-700 dark:text-lime-400" />
            כל החלופות שומרות על אותה תבנית תנועה וקבוצת שריר - אפשר להחליף בביטחון מבלי לפגוע בתוכנית.
          </div>

          {alternatives.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-600 dark:text-zinc-500">
              אין עדיין חלופות זמינות לתרגיל הזה.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {alternatives.map((alt) => (
                <AlternativeCard key={alt.id} alternative={alt} onSelect={() => onSwap(alt)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AlternativeCard({ alternative, onSelect }: { alternative: ExerciseAlternative; onSelect: () => void }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{alternative.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">{alternative.nameEn}</p>
        </div>
        <span className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
          {EQUIPMENT_LABELS[alternative.equipment]}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          {DIFFICULTY_LABELS[alternative.difficulty]}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">למה כדאי? </span>
        {alternative.reason}
      </p>

      <button type="button" onClick={onSelect} className="btn-primary self-start text-xs">
        בחר תרגיל זה
      </button>
    </div>
  );
}
