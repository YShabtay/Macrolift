import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Bot, Check, Loader2, MessageCircle, Minus, Percent, RotateCw, Send, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import type { AppState, Goal, GoalIntensity, ProgressPhoto, WeightLog } from '../types/fitness';
import {
  hasGeminiApiKey,
  MissingApiKeyError,
  reviewProgressPhotos,
  sendProgressFollowUp,
  type ChatMessage,
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
  /** Full app state, so follow-up answers can use the user's real calorie target, macros and profile. */
  appState: AppState;
  onApplyCalorieAdjustment: (deltaKcal: number) => void;
  onClose: () => void;
}

export default function ProgressAIReviewModal({
  beforePhoto,
  afterPhoto,
  weightLogs,
  goal,
  goalIntensity,
  appState,
  onApplyCalorieAdjustment,
  onClose,
}: ProgressAIReviewModalProps) {
  const [status, setStatus] = useState<ReviewStatus>(() => (hasGeminiApiKey ? 'analyzing' : 'error'));
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<ProgressReviewResult | null>(null);
  const [isApplied, setIsApplied] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatRequestRef = useRef(0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [chat, isReplying, chatError]);

  // Closing (or re-running the analysis) must not let a late reply land in a stale thread.
  useEffect(() => () => void chatRequestRef.current++, []);

  async function requestReply(history: ChatMessage[]) {
    if (!result) return;
    const requestId = ++chatRequestRef.current;
    setIsReplying(true);
    setChatError('');
    try {
      const reply = await sendProgressFollowUp(history, appState, {
        goal,
        goalIntensity,
        beforeDate: beforePhoto.date,
        afterDate: afterPhoto.date,
        daysBetween: Math.abs(daysBetween(beforePhoto.date, afterPhoto.date)),
        beforeWeightKg: beforePhoto.weightKg ?? estimateWeightForDate(weightLogs, beforePhoto.date),
        afterWeightKg: afterPhoto.weightKg ?? estimateWeightForDate(weightLogs, afterPhoto.date),
        review: result,
      });
      if (requestId !== chatRequestRef.current) return;
      setChat([...history, { role: 'model', text: reply }]);
    } catch (err) {
      if (requestId !== chatRequestRef.current) return;
      setChatError(err instanceof Error ? err.message : 'לא התקבלה תשובה, נסו שוב.');
    } finally {
      if (requestId === chatRequestRef.current) setIsReplying(false);
    }
  }

  function askQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isReplying) return;
    const history: ChatMessage[] = [...chat, { role: 'user', text: trimmed }];
    setChat(history);
    setQuestion('');
    void requestReply(history);
  }

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

            <div className="flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-lime-700 dark:text-lime-400" />
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">המשך הדיון עם המאמן</p>
              </div>

              {chat.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {getFollowUpQuestions(goal, result.isPlateaued).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => askQuestion(q)}
                      disabled={isReplying}
                      className="rounded-full border border-lime-400/40 bg-lime-400/5 px-3.5 py-2 text-right text-xs font-semibold leading-snug text-lime-700 dark:text-lime-400 transition hover:border-lime-400/70 hover:bg-lime-400/15 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {chat.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  {chat.map((m, i) =>
                    m.role === 'user' ? (
                      <div key={i} className="max-w-[88%] self-start whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-lime-400 px-3.5 py-2.5 text-sm font-medium leading-relaxed text-zinc-950">
                        {m.text}
                      </div>
                    ) : (
                      <div key={i} className="flex max-w-[94%] items-start gap-2 self-end">
                        <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-400/10 text-lime-700 dark:text-lime-400">
                          <Bot className="h-3.5 w-3.5" />
                        </span>
                        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                          {m.text}
                        </div>
                      </div>
                    ),
                  )}
                  {isReplying && (
                    <div className="flex items-center gap-2 self-end text-xs text-zinc-600 dark:text-zinc-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      המאמן כותב תשובה...
                    </div>
                  )}
                  {chatError && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-orange-400/30 bg-orange-400/5 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {chatError}
                      </span>
                      <button type="button" onClick={() => void requestReply(chat)} className="shrink-0 font-bold underline">
                        נסה שוב
                      </button>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              {chat.length === 0 && isReplying && (
                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  המאמן כותב תשובה...
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  askQuestion(question);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="שאלו את המאמן על הניתוח..."
                  aria-label="שאלת המשך למאמן"
                  maxLength={500}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
                />
                <button
                  type="submit"
                  disabled={isReplying || question.trim() === ''}
                  aria-label="שליחה"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-zinc-950 transition active:scale-95 disabled:opacity-40"
                >
                  <Send className="h-4 w-4 -scale-x-100" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Suggested follow-ups, tuned to the user's goal (and to a detected plateau) so the chips are actually relevant. */
function getFollowUpQuestions(goal: Goal, isPlateaued: boolean): string[] {
  if (goal === 'gain_muscle') {
    return [
      'איך למקסם עלייה בשריר מנקודה זו?',
      'האם כדאי להעלות קלוריות בתפריט עכשיו?',
      'איך לשמור על אחוזי שומן נמוכים במסה?',
    ];
  }
  if (goal === 'lose_weight') {
    return [
      'איך לשמור על מסת שריר בזמן הירידה?',
      isPlateaued ? 'איך אני שובר את העצירה הזו?' : 'האם כדאי להוריד קלוריות עכשיו?',
      'איך להאיץ את הירידה בשומן בלי לפגוע באנרגיה?',
    ];
  }
  return [
    'איך לשפר את הרכב הגוף מנקודה זו?',
    isPlateaued ? 'איך אני שובר את העצירה הזו?' : 'האם כדאי לשנות את הקלוריות בתפריט?',
    'על מה כדאי להתמקד באימונים בתקופה הקרובה?',
  ];
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
