import { formatMacro } from '../utils/formatMacro';
import { useRestTimer } from '../context/restTimerContext';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Bot, Camera, Check, RotateCw, Send, X } from 'lucide-react';
import type { AppState, FoodEntry } from '../types/fitness';
import { hasGeminiApiKey, sendCoachMessage, type ChatMessage } from '../services/geminiChat';
import PhotoSourceSheet from './PhotoSourceSheet';
import { prepareImageForAI, scanMealImage, type FoodScanResult } from '../services/aiFoodScanner';
import { calculateRemaining, getEntriesForDate, getMealForCurrentTime, sumTotals } from '../utils/nutritionLog';
import { compressImageToDataUrl } from '../utils/imageEncoding';
import { todayIso } from '../utils/weightCalculations';
import Toast from './Toast';

interface AICoachDrawerProps {
  appState: AppState;
  userId: string;
  onAddFood: (entry: Omit<FoodEntry, 'id'>) => void;
}

/** What will remain of today's calorie/protein target once this meal is logged. */
function computeRemainingAfterMeal(appState: AppState, result: FoodScanResult): { calories: number; proteinG: number } {
  const today = todayIso();
  const eatenToday = sumTotals(getEntriesForDate(appState.foodLog, today));
  const remaining = calculateRemaining(appState.nutritionPlan.targetCalories, appState.nutritionPlan.macros, eatenToday);
  return {
    calories: remaining.calories - result.calories,
    proteinG: remaining.proteinG - result.protein,
  };
}

type DrawerMessage =
  | { id: string; kind: 'text'; role: 'user' | 'model'; text: string }
  | { id: string; kind: 'user-image'; imageDataUrl: string; caption?: string }
  | { id: string; kind: 'meal-scan'; result: FoodScanResult; added: boolean };

const QUICK_PROMPTS = [
  'איך כדאי לחלק את החלבון שלי היום?',
  'תמליץ לי על תרגיל חלופי לחזה',
  'מה לאכול לפני ואחרי האימון?',
];

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function storageKey(userId: string): string {
  return `macrolift-ai-chat-${userId}`;
}

function isDrawerMessage(value: unknown): value is DrawerMessage {
  const kind = (value as { kind?: unknown } | null)?.kind;
  return kind === 'text' || kind === 'user-image' || kind === 'meal-scan';
}

/** Filters out anything that doesn't match a known message shape, so a schema change or corrupted entry can't crash the render. */
function loadHistory(userId: string): DrawerMessage[] {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isDrawerMessage) : [];
  } catch {
    return [];
  }
}

export default function AICoachDrawer({ appState, userId, onAddFood }: AICoachDrawerProps) {
  // Lift the button clear of the rest-timer bar/card so it never sits on top of it.
  const isRestTimerShown = useRestTimer().status !== 'idle';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DrawerMessage[]>(() => loadHistory(userId));
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<(() => void) | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPhotoSheetOpen, setIsPhotoSheetOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(userId), JSON.stringify(messages));
    } catch {
      // sessionStorage full/unavailable - the conversation just won't survive a reload.
    }
  }, [userId, messages]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  async function handleSendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const nextMessages: DrawerMessage[] = [...messages, { id: crypto.randomUUID(), kind: 'text', role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setInput('');
    await requestCoachReply(nextMessages);
  }

  /** Sends the current text history to the coach; kept separate from handleSendText so a retry doesn't re-append the user's message. */
  async function requestCoachReply(nextMessages: DrawerMessage[]) {
    setError(null);
    setLastFailedAction(null);
    setIsLoading(true);

    try {
      const history: ChatMessage[] = nextMessages
        .filter((m) => m.kind === 'text')
        .map((m) => ({ role: m.role, text: m.text }));
      const reply = await sendCoachMessage(history, appState);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), kind: 'text', role: 'model', text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'משהו השתבש בתקשורת עם המאמן. נסו שוב בעוד רגע.');
      setLastFailedAction(() => () => requestCoachReply(nextMessages));
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePickImage(file: File) {

    if (file.size > MAX_UPLOAD_BYTES) {
      setError('הקובץ גדול מדי (מקסימום 15MB). נסו תמונה קטנה יותר.');
      return;
    }

    setError(null);
    try {
      const previewUrl = await compressImageToDataUrl(file);
      setPendingImage({ file, previewUrl });
    } catch {
      setError('טעינת התמונה נכשלה, נסו תמונה אחרת.');
    }
  }

  async function handleSendImage() {
    if (!pendingImage || isLoading) return;
    const { file, previewUrl } = pendingImage;
    const caption = input.trim();

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), kind: 'user-image', imageDataUrl: previewUrl, caption: caption || undefined },
    ]);
    setPendingImage(null);
    setInput('');
    await requestMealScan(file);
  }

  /** Runs the vision scan for an already-sent photo; kept separate so a retry doesn't re-send the image message. */
  async function requestMealScan(file: File) {
    setError(null);
    setLastFailedAction(null);
    setIsLoading(true);

    try {
      const { base64, mimeType } = await prepareImageForAI(file);
      const result = await scanMealImage(base64, mimeType);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), kind: 'meal-scan', result, added: false }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ניתוח התמונה נכשל. נסו תמונה ברורה וחדה יותר.');
      setLastFailedAction(() => () => requestMealScan(file));
    } finally {
      setIsLoading(false);
    }
  }

  function handlePrimarySend() {
    if (pendingImage) handleSendImage();
    else handleSendText(input);
  }

  function handleAddMealToTracking(messageId: string, result: FoodScanResult) {
    onAddFood({
      date: todayIso(),
      meal: getMealForCurrentTime(),
      name: result.foodName,
      quantity: `${result.estimatedWeightGrams} גרם`,
      weightGrams: result.estimatedWeightGrams,
      calories: result.calories,
      proteinG: result.protein,
      fatG: result.fats,
      carbsG: result.carbs,
    });
    setMessages((prev) => prev.map((m) => (m.id === messageId && m.kind === 'meal-scan' ? { ...m, added: true } : m)));

    const remainingAfter = computeRemainingAfterMeal(appState, result);
    setToastMessage(
      `הארוחה נוספה ליומן היומי! נותרו לך עוד ${formatMacro(remainingAfter.calories)} קק״ל ו-${formatMacro(remainingAfter.proteinG)} גרם חלבון להיום`,
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="פתיחת המאמן הדיגיטלי"
        className={`fixed left-4 z-40 ${
          isRestTimerShown ? 'bottom-[calc(9rem+env(safe-area-inset-bottom))] md:bottom-28' : 'bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6'
        } flex h-14 w-14 items-center justify-center rounded-full bg-lime-400 text-zinc-950 shadow-xl transition-[bottom,transform] hover:scale-105 hover:bg-lime-500 active:scale-95 md:left-6`}
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-lime-400/40" />
        <Bot className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {isOpen &&
        createPortal(
          <div
            data-safe-area="self"
            className="fixed inset-0 z-50 flex justify-end bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="flex h-full w-full max-w-md flex-col border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shadow-glow animate-slide-in-right"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 px-4 pb-3 pt-[max(env(safe-area-inset-top),1.5rem)]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">המאמן הדיגיטלי שלך</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-500">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-500" />
                      </span>
                      מחובר
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="סגירה"
                  className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 dark:text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!hasGeminiApiKey ? (
                <MissingApiKeyNotice />
              ) : (
                <>
                  <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                    {messages.length === 0 && (
                      <>
                        <div className="glass-card flex items-start gap-2.5 border-lime-400/20 bg-lime-400/5 p-3.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-lime-700 dark:text-lime-400" />
                          <p>
                            שלום! אני המאמן הדיגיטלי שלך ב-MacroLift. אפשר לשאול אותי על התוכנית, התזונה או האימונים
                            שלך, או לצלם ארוחה ואני אעריך את הערכים התזונתיים שלה.
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {QUICK_PROMPTS.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => handleSendText(prompt)}
                              className="rounded-xl border border-lime-400/30 bg-lime-400/5 px-3.5 py-2.5 text-right text-sm font-medium text-lime-700 dark:text-lime-400 transition hover:border-lime-400/60 hover:bg-lime-400/10"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {messages.map((m) => (
                      <DrawerMessageBubble
                        key={m.id}
                        message={m}
                        appState={appState}
                        onAddToTracking={() => m.kind === 'meal-scan' && handleAddMealToTracking(m.id, m.result)}
                      />
                    ))}

                    {isLoading && (
                      <div className="flex items-center gap-1.5 self-start rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 py-3">
                        <span className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-lime-700 dark:bg-lime-400 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-lime-700 dark:bg-lime-400 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-lime-700 dark:bg-lime-400 [animation-delay:300ms]" />
                      </div>
                    )}

                    {error && (
                      <div className="flex flex-col gap-2 self-start rounded-2xl border border-orange-400/30 bg-orange-400/5 px-3.5 py-2.5 text-sm text-orange-700 dark:text-orange-300">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {error}
                        </div>
                        {lastFailedAction && (
                          <button
                            type="button"
                            onClick={lastFailedAction}
                            className="flex items-center gap-1.5 self-start rounded-lg border border-orange-400/40 px-2.5 py-1 text-xs font-semibold transition hover:bg-orange-400/10"
                          >
                            <RotateCw className="h-3 w-3" />
                            נסה שוב
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-zinc-200 dark:border-zinc-800 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
                    {pendingImage && (
                      <div className="flex items-center gap-2 self-start rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5">
                        <img src={pendingImage.previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                        <button
                          type="button"
                          onClick={() => setPendingImage(null)}
                          aria-label="הסרת התמונה"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition hover:bg-zinc-300 dark:hover:bg-zinc-700"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPhotoSheetOpen(true)}
                        aria-label="צילום או בחירת תמונת ארוחה מהגלריה"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handlePrimarySend();
                          }
                        }}
                        placeholder={pendingImage ? 'הוסיפו הערה לתמונה (לא חובה)...' : 'שאלו אותי כל דבר על התוכנית שלכם...'}
                        className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                      />
                      <button
                        type="button"
                        onClick={handlePrimarySend}
                        disabled={(!input.trim() && !pendingImage) || isLoading}
                        aria-label="שליחה"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-zinc-950 transition disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send className="h-4 w-4 -scale-x-100" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {isPhotoSheetOpen && (
        <PhotoSourceSheet onFile={(file) => void handlePickImage(file)} onClose={() => setIsPhotoSheetOpen(false)} />
      )}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </>
  );
}

function DrawerMessageBubble({
  message,
  appState,
  onAddToTracking,
}: {
  message: DrawerMessage;
  appState: AppState;
  onAddToTracking: () => void;
}) {
  if (message.kind === 'text') {
    return (
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          message.role === 'user'
            ? 'self-end bg-zinc-800 text-zinc-100'
            : 'self-start border border-lime-400/30 bg-lime-400/10 text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {message.text}
      </div>
    );
  }

  if (message.kind === 'user-image') {
    return (
      <div className="flex max-w-[75%] flex-col gap-1.5 self-end rounded-2xl bg-zinc-800 p-1.5">
        <img src={message.imageDataUrl} alt="" className="max-h-48 rounded-xl object-cover" />
        {message.caption && <p className="px-1.5 pb-1 text-sm leading-relaxed text-zinc-100">{message.caption}</p>}
      </div>
    );
  }

  if (message.kind === 'meal-scan') {
    return <MealScanCard message={message} appState={appState} onAddToTracking={onAddToTracking} />;
  }

  return null;
}

function MealScanCard({
  message,
  appState,
  onAddToTracking,
}: {
  message: Extract<DrawerMessage, { kind: 'meal-scan' }>;
  appState: AppState;
  onAddToTracking: () => void;
}) {
  const { result, added } = message;
  const remainingAfter = computeRemainingAfterMeal(appState, result);

  return (
    <div className="glass-card flex max-w-[92%] flex-col gap-3 self-start border-lime-400/20 p-3.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-zinc-900 dark:text-zinc-100">{result.foodName}</p>
        <span className="shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          {result.estimatedWeightGrams} גר׳
        </span>
      </div>

      {result.confidence !== 'high' && (
        <div className="flex items-center gap-1.5 rounded-lg border border-orange-400/30 bg-orange-400/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-orange-700 dark:text-orange-300">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          רמת הביטחון בזיהוי {result.confidence === 'low' ? 'נמוכה' : 'בינונית'} - אם התמונה מטושטשת, כדאי לצלם שוב.
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 text-center">
        <MacroStat label="קלוריות" value={result.calories} valueClassName="text-lime-700 dark:text-lime-400" />
        <MacroStat label="חלבון" value={`${result.protein}ג׳`} valueClassName="text-sky-700 dark:text-sky-400" />
        <MacroStat label="פחמימה" value={`${result.carbs}ג׳`} valueClassName="text-amber-700 dark:text-amber-400" />
        <MacroStat label="שומן" value={`${result.fats}ג׳`} valueClassName="text-yellow-700 dark:text-yellow-400" />
      </div>

      {result.breakdown.length > 0 && (
        <div className="flex flex-col gap-1">
          {result.breakdown.map((b, i) => (
            <div
              key={`${b.item}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/60 dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">
                {b.item} <span className="text-zinc-500 dark:text-zinc-500">· {b.amount}</span>
              </span>
              <span className="shrink-0 text-zinc-600 dark:text-zinc-400">{b.calories} קק״ל</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-500">
        אחרי הארוחה הזו יישארו לך היום{' '}
        <span className="font-semibold text-zinc-800 dark:text-zinc-300">
          {formatMacro(remainingAfter.calories)} קק״ל ו-{formatMacro(remainingAfter.proteinG)} גר׳ חלבון
        </span>
        .
      </p>

      <button
        type="button"
        onClick={onAddToTracking}
        disabled={added}
        className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        {added ? (
          <>
            <Check className="h-3.5 w-3.5" />
            נוסף למעקב
          </>
        ) : (
          'הוסף ארוחה זו למעקב היומי'
        )}
      </button>
    </div>
  );
}

function MacroStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName: string;
}) {
  return (
    <div className="rounded-lg bg-white/60 dark:bg-zinc-900/60 px-1.5 py-2">
      <p className={`text-sm font-bold ${valueClassName}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

function MissingApiKeyNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-orange-700 dark:text-orange-400" />
      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">המאמן הדיגיטלי לא מחובר</p>
      <p className="max-w-sm text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
                  שירות ה-AI אינו זמין כרגע. נסו שוב מאוחר יותר.
                </p>
    </div>
  );
}
