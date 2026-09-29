import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Loader2, Minus, Percent, RotateCw, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import type { Goal, GoalIntensity, ProgressPhoto, WeightLog } from '../types/fitness';
import {
  hasGeminiApiKey,
  MissingApiKeyError,
  reviewProgressPhotos,
  type MuscleMassTrend,
  type ProgressReviewResult,
} from '../services/geminiChat';
import { dataUrlToBase64 } from '../utils/imageEncoding';
import { daysBetween, estimateWeightForDate, formatDateDisplay, getLatestWeekSummary } from '../utils/weightCalculations';

type ReviewStatus = 'analyzing' | 'result' | 'error';

interface ProgressAIReviewModalProps {
  beforePhoto: ProgressPhoto;
  afterPhoto: ProgressPhoto;
  weightLogs: WeightLog[];
  goal: Goal;
  goalIntensity?: GoalIntensity;
  onApplyCalorieAdjustment: (deltaKcal: number) => void;
  onClose: () => void;
}

export default function ProgressAIReviewModal({
  beforePhoto,
  afterPhoto,
  weightLogs,
  goal,
  goalIntensity,
  onApplyCalorieAdjustment,
  onClose,
}: ProgressAIReviewModalProps) {
  const [status, setStatus] = useState<ReviewStatus>(() => (hasGeminiApiKey ? 'analyzing' : 'error'));
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<ProgressReviewResult | null>(null);
  const [isApplied, setIsApplied] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!hasGeminiApiKey) return;

    let cancelled = false;

    async function run() {
      setStatus('analyzing');
      try {
        const before = dataUrlToBase64(beforePhoto.photoUrl);
        const after = dataUrlToBase64(afterPhoto.photoUrl);
        const weeklySummary = getLatestWeekSummary(weightLogs);

        const review = await reviewProgressPhotos([before, after], {
          goal,
          goalIntensity,
          beforeDate: beforePhoto.date,
          afterDate: afterPhoto.date,
          daysBetween: Math.abs(daysBetween(beforePhoto.date, afterPhoto.date)),
          beforeWeightKg: beforePhoto.weightKg ?? estimateWeightForDate(weightLogs, beforePhoto.date),
          afterWeightKg: afterPhoto.weightKg ?? estimateWeightForDate(weightLogs, afterPhoto.date),
          weeklyTrendDeltaKg: weeklySummary?.deltaFromPreviousWeek ?? null,
        });
        if (cancelled) return;
        setResult(review);
        setStatus('result');
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof MissingApiKeyError ? '' : err instanceof Error ? err.message : 'הניתוח נכשל, נסו שוב.',
        );
        setStatus('error');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // Runs once per mount (plus on retry) - the modal is always freshly mounted when opened, so these props never change in place.
  }, [beforePhoto, afterPhoto, weightLogs, goal, goalIntensity, retryToken]);

  function handleApply() {
    if (!result?.calorieAdjustment) return;
    onApplyCalorieAdjustment(result.calorieAdjustment);
    setIsApplied(true);
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
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">ניתוח התקדמות עם AI</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 p-4 pb-0">
          <PhotoPreview photo={beforePhoto} label="לפני" />
          <PhotoPreview photo={afterPhoto} label="אחרי" />
        </div>

        {status === 'analyzing' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-lime-700 dark:text-lime-400" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">מנתח את ההתקדמות שלך בעזרת AI...</p>
            <div className="flex w-full max-w-xs flex-col gap-2">
              <div className="h-3 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-3/4 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        )}

        {status === 'error' &&
          (!hasGeminiApiKey ? (
            <MissingApiKeyNotice />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-orange-700 dark:text-orange-400" />
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">הניתוח נכשל</p>
              <p className="max-w-xs text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">{errorMessage}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRetryToken((t) => t + 1)} className="btn-primary text-xs">
                  <RotateCw className="h-3.5 w-3.5" />
                  נסה שוב
                </button>
                <button type="button" onClick={onClose} className="btn-secondary text-xs">
                  סגירה
                </button>
              </div>
            </div>
          ))}

        {status === 'result' && result && (
          <div className="flex flex-col gap-4 p-4">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-lime-700 dark:text-lime-400" />
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">הערכה ויזואלית</p>
                <span
                  className={`mr-auto rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    result.isPlateaued
                      ? 'bg-orange-400/10 text-orange-700 dark:text-orange-400'
                      : 'bg-lime-400/10 text-lime-700 dark:text-lime-400'
                  }`}
                >
                  {result.isPlateaued ? 'זוהתה עצירה' : 'התקדמות תקינה'}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{result.visualAssessment}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-zinc-600 dark:text-zinc-500">
                  <Percent className="h-3.5 w-3.5" />
                  <span className="text-[11px]">אחוז שומן (הערכה חזותית)</span>
                </div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{result.bodyFatEstimateRange}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-zinc-600 dark:text-zinc-500">
                  <MuscleMassIcon trend={result.muscleMassTrend} />
                  <span className="text-[11px]">מסת שריר נראית לעין</span>
                </div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{MUSCLE_MASS_LABELS[result.muscleMassTrend]}</p>
                {result.muscleMassNote && (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">{result.muscleMassNote}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-lime-400/30 bg-lime-400/5 p-3.5">
              <p className="mb-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">{result.recommendationTitle}</p>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{result.recommendationText}</p>

              {result.calorieAdjustment !== undefined && result.calorieAdjustment !== 0 && (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isApplied}
                  className="btn-primary mt-3 w-full text-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isApplied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      היעד עודכן
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      עדכן יעד קלוריות בהתאם להמלצה ({result.calorieAdjustment > 0 ? '+' : ''}
                      {result.calorieAdjustment} קק״ל)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const MUSCLE_MASS_LABELS: Record<MuscleMassTrend, string> = {
  increase: 'עלייה נראית לעין',
  stable: 'יציבה',
  decrease: 'ירידה נראית לעין',
};

function MuscleMassIcon({ trend }: { trend: MuscleMassTrend }) {
  if (trend === 'increase') return <TrendingUp className="h-3.5 w-3.5 text-lime-700 dark:text-lime-400" />;
  if (trend === 'decrease') return <TrendingDown className="h-3.5 w-3.5 text-orange-700 dark:text-orange-400" />;
  return <Minus className="h-3.5 w-3.5" />;
}

function PhotoPreview({ photo, label }: { photo: ProgressPhoto; label: string }) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-xl">
      <img src={photo.photoUrl} alt={label} className="aspect-[3/4] w-full object-cover" />
      <span className="absolute right-1.5 top-1.5 rounded-md bg-zinc-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
        {label} · {formatDateDisplay(photo.date)}
      </span>
    </div>
  );
}

function MissingApiKeyNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-orange-700 dark:text-orange-400" />
      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">ניתוח AI לא מחובר</p>
      <p className="max-w-sm text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
        כדי להפעיל את הניתוח, יש להגדיר מפתח API חינמי של Gemini (מתוך Google AI Studio) במשתנה הסביבה{' '}
        <code className="rounded bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300">VITE_GEMINI_API_KEY</code> בקובץ{' '}
        <code className="rounded bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300">.env.local</code>, ולהפעיל מחדש את השרת.
      </p>
    </div>
  );
}
