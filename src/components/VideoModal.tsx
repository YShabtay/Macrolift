import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ExternalLink, Link2, Pencil, RotateCcw, X, Youtube } from 'lucide-react';
import type { Exercise } from '../types/fitness';
import { MUSCLE_GROUP_LABELS } from '../data/muscleLabels';
import { storageService } from '../services/storageService';
import { buildYouTubeSearchUrl, isValidYouTubeId, isVideoFile, parseYouTubeId, resolveExerciseNameEn } from '../utils/exerciseVideo';

interface VideoModalProps {
  exercise: Exercise | null;
  onClose: () => void;
}

export default function VideoModal({ exercise, onClose }: VideoModalProps) {
  // The user's own chosen video per exercise (keyed by Hebrew name so it survives plan changes and swaps).
  const [customVideos, setCustomVideos] = useState<Record<string, string>>({});
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (!exercise) return;
    let cancelled = false;
    storageService.getCustomExerciseVideos().then((videos) => {
      if (!cancelled) setCustomVideos(videos);
    });
    return () => {
      cancelled = true;
    };
  }, [exercise]);

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

  const customId = customVideos[exercise.name];
  const videoId = isValidYouTubeId(customId) ? customId : isValidYouTubeId(exercise.youtubeId) ? exercise.youtubeId : null;
  const nameEn = resolveExerciseNameEn(exercise);
  const searchUrl = buildYouTubeSearchUrl(nameEn);
  const hasCustomVideo = videoId !== null && videoId === customId;

  async function persistCustomVideos(next: Record<string, string>) {
    setCustomVideos(next);
    try {
      await storageService.saveCustomExerciseVideos(next);
    } catch {
      setLinkError('לא ניתן היה לשמור את הקישור (האחסון חסום או מלא)');
    }
  }

  function openLinkEditor() {
    setLinkDraft(hasCustomVideo ? `https://www.youtube.com/watch?v=${customId}` : '');
    setLinkError('');
    setIsEditingLink(true);
  }

  async function saveLink() {
    if (!exercise) return;
    const id = parseYouTubeId(linkDraft);
    if (!id) {
      setLinkError('הקישור אינו קישור יוטיוב תקין. הדביקו קישור לסרטון, למשל https://youtu.be/...');
      return;
    }
    await persistCustomVideos({ ...customVideos, [exercise.name]: id });
    setIsEditingLink(false);
  }

  async function resetLink() {
    if (!exercise) return;
    const { [exercise.name]: _removed, ...rest } = customVideos;
    await persistCustomVideos(rest);
    setIsEditingLink(false);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0">
          {exercise.demoUrl && <DemoAnimation url={exercise.demoUrl} title={exercise.name} />}

          {videoId ? (
            <div className="relative aspect-video w-full bg-black">
              <iframe
                key={videoId}
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
                title={exercise.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                loading="lazy"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 bg-zinc-100 dark:bg-zinc-900/70 px-6 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg">
                <Youtube className="h-7 w-7" />
              </span>
              <div>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">מדריך טכניקה לתרגיל</p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500" dir="ltr">
                  {nameEn}
                </p>
              </div>
              <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full max-w-xs"
              >
                צפה בהדגמה ב-YouTube ↗
              </a>
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

          <div className="flex flex-wrap items-center gap-2">
            {videoId && (
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                פתיחה ישירה ביוטיוב
              </a>
            )}
            {videoId && (
              <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-zinc-600 underline dark:text-zinc-500">
                הסרטון לא נטען? חיפוש ביוטיוב
              </a>
            )}
            {!isEditingLink && (
              <button type="button" onClick={openLinkEditor} className="flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-lime-400/50">
                <Pencil className="h-3.5 w-3.5" />
                ערוך קישור וידאו
              </button>
            )}
          </div>

          {isEditingLink && (
            <div className="flex flex-col gap-2 rounded-xl border border-lime-400/30 bg-lime-400/5 p-3 animate-fade-in">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <Link2 className="h-3.5 w-3.5" />
                הדביקו קישור יוטיוב מועדף לתרגיל זה
              </label>
              <input
                type="url"
                dir="ltr"
                autoFocus
                value={linkDraft}
                onChange={(e) => {
                  setLinkDraft(e.target.value);
                  setLinkError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && void saveLink()}
                placeholder="https://www.youtube.com/watch?v=..."
                aria-label="קישור וידאו"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-left text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
              />
              {linkError && <p className="text-[11px] font-medium text-red-400">{linkError}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void saveLink()} className="btn-primary px-4 text-xs">
                  <Check className="h-3.5 w-3.5" />
                  שמירה
                </button>
                {hasCustomVideo && (
                  <button type="button" onClick={() => void resetLink()} className="btn-secondary px-3 text-xs">
                    <RotateCcw className="h-3.5 w-3.5" />
                    חזרה לברירת המחדל
                  </button>
                )}
                <button type="button" onClick={() => setIsEditingLink(false)} className="btn-secondary px-3 text-xs">
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Short looping demo shown above the video. Video files play muted + inline so they never take over the audio
 * session (background music keeps playing); GIFs are plain images.
 */
function DemoAnimation({ url, title }: { url: string; title: string }) {
  return (
    <div className="aspect-video w-full bg-black">
      {isVideoFile(url) ? (
        <video src={url} className="h-full w-full object-contain" muted loop autoPlay playsInline preload="metadata" aria-label={title} />
      ) : (
        <img src={url} alt={title} className="h-full w-full object-contain" loading="lazy" />
      )}
    </div>
  );
}
