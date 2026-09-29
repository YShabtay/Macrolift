import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import type { Exercise } from '../types/fitness';
import { MUSCLE_GROUP_LABELS } from '../data/muscleLabels';

interface VideoModalProps {
  exercise: Exercise | null;
  onClose: () => void;
}

export default function VideoModal({ exercise, onClose }: VideoModalProps) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video w-full shrink-0 bg-black">
          {exercise.youtubeId ? (
            <iframe
              key={exercise.youtubeId}
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${exercise.youtubeId}?rel=0&modestbranding=1`}
              title={exercise.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-zinc-600 dark:text-zinc-500">
              אין סרטון הדרכה זמין לתרגיל זה
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950/80 text-zinc-700 dark:text-zinc-300 backdrop-blur transition hover:bg-white dark:hover:bg-zinc-900 hover:text-white active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{exercise.name}</h3>
              <span className="rounded-lg border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 text-xs font-semibold text-lime-700 dark:text-lime-400">
                {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-500">
              {exercise.sets} סטים &middot; {exercise.repsRange} חזרות &middot; מנוחה {exercise.restSeconds} שנ׳
            </p>
          </div>

          {exercise.cues && exercise.cues.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">דגשים לביצוע נכון</p>
              <ul className="flex flex-col gap-1.5">
                {exercise.cues.map((cue) => (
                  <li key={cue} className="flex items-start gap-2 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />
                    {cue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {exercise.youtubeId && (
            <a
              href={`https://www.youtube.com/watch?v=${exercise.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary self-start text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              פתיחה ישירה ביוטיוב
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
