import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Loader2, Mic, MicOff, RotateCw, Square, Trash2, X } from 'lucide-react';
import type { FoodEntry, Meal } from '../types/fitness';
import { MEAL_LABELS, MEAL_ORDER, toUnitLabel } from '../utils/nutritionLog';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import DecimalInput from './DecimalInput';
import { MissingApiKeyError, parseMealDescription, type VoiceFoodItem } from '../services/voiceMealParser';

type Stage = 'record' | 'analyzing' | 'review' | 'error';

interface VoiceMealModalProps {
  meal: Meal;
  date: string;
  onClose: () => void;
  /** Receives every confirmed food at once; each becomes one entry in the food log. */
  onConfirm: (entries: Omit<FoodEntry, 'id'>[]) => void;
}

/** A parsed item plus the weight the user is currently typing; macros scale linearly from the AI's estimate. */
interface ReviewRow {
  item: VoiceFoodItem;
  gramsInput: string;
}

function scaled(row: ReviewRow) {
  const grams = Number(row.gramsInput);
  const factor = Number.isFinite(grams) && grams > 0 ? grams / row.item.grams : 0;
  return {
    grams: factor > 0 ? grams : 0,
    // The spoken amount ("3 ביצים") only describes the original weight; once the user edits it, fall back to the food name.
    unitLabel: factor === 1 ? toUnitLabel(row.item.amount) : undefined,
    calories: Math.round(row.item.calories * factor),
    protein: Math.round(row.item.protein * factor * 10) / 10,
    carbs: Math.round(row.item.carbs * factor * 10) / 10,
    fat: Math.round(row.item.fat * factor * 10) / 10,
  };
}

export default function VoiceMealModal({ meal: initialMeal, date, onClose, onConfirm }: VoiceMealModalProps) {
  const [stage, setStage] = useState<Stage>('record');
  const [transcript, setTranscript] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal>(initialMeal);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMissingKey, setIsMissingKey] = useState(false);
  const requestRef = useRef(0);

  async function analyze(text: string) {
    const requestId = ++requestRef.current;
    setStage('analyzing');
    setIsMissingKey(false);
    try {
      const items = await parseMealDescription(text);
      if (requestId !== requestRef.current) return;
      setRows(items.map((item) => ({ item, gramsInput: String(item.grams) })));
      setStage('review');
    } catch (err) {
      if (requestId !== requestRef.current) return;
      if (err instanceof MissingApiKeyError) setIsMissingKey(true);
      else setErrorMessage(err instanceof Error ? err.message : 'הניתוח נכשל, נסו שוב.');
      setStage('error');
    }
  }

  const speech = useSpeechRecognition({
    lang: 'he-IL',
    onTranscript: setTranscript,
    onFinished: (text) => {
      // Stopping with nothing captured stays on the record screen (with the reason, if the browser gave one).
      if (text.trim().length > 1) void analyze(text);
    },
  });

  // Begin listening right away - the modal opens from the user's tap, which is the gesture iOS requires.
  const { start, abort } = speech;
  useEffect(() => {
    start();
  }, [start]);

  function closeModal() {
    requestRef.current++;
    abort();
    onClose();
  }

  function restart() {
    requestRef.current++;
    setStage('record');
    setTranscript('');
    setRows([]);
    start();
  }

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          const s = scaled(row);
          return {
            calories: acc.calories + s.calories,
            protein: acc.protein + s.protein,
            carbs: acc.carbs + s.carbs,
            fat: acc.fat + s.fat,
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [rows],
  );

  const validRows = rows.filter((r) => scaled(r).grams > 0);

  function handleConfirm() {
    if (validRows.length === 0) return;
    onConfirm(
      validRows.map((row) => {
        const s = scaled(row);
        return {
          date,
          meal: selectedMeal,
          name: row.item.name,
          ...(s.unitLabel ? { unitLabel: s.unitLabel } : {}),
          quantity: `${s.grams} גרם`,
          weightGrams: s.grams,
          calories: s.calories,
          proteinG: s.protein,
          fatG: s.fat,
          carbsG: s.carbs,
        };
      }),
    );
    onClose();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={closeModal}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <Mic className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">הקלטה מהירה ב-AI</h3>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="סגירה"
            className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {stage === 'record' && (
          <div className="flex flex-col items-center gap-4 p-5 text-center">
            {speech.isListening ? (
              <>
                <div className="relative flex h-24 w-24 items-center justify-center" aria-live="polite">
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
                  <span className="absolute inset-2 animate-pulse rounded-full bg-red-500/20" />
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg">
                    <Mic className="h-7 w-7" />
                  </span>
                </div>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">מקליט... ספר מה אכלת</p>
                <p className="min-h-[3rem] w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-3 py-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {transcript || 'למשל: "אכלתי 200 גרם חזה עוף וכוס אורז"'}
                </p>
                <button
                  type="button"
                  onClick={speech.stop}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 active:scale-95"
                >
                  <Square className="h-4 w-4 fill-current" />
                  סיום וניתוח
                </button>
              </>
            ) : (
              <>
                {!speech.isSupported && (
                  <p className="flex items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-400/5 px-3 py-2 text-xs leading-relaxed text-orange-700 dark:text-orange-300">
                    <MicOff className="h-3.5 w-3.5 shrink-0" />
                    הדפדפן הזה לא תומך בזיהוי דיבור. אפשר להקליד את מה שאכלתם ולנתח.
                  </p>
                )}
                {speech.error && (
                  <p className="flex items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-400/5 px-3 py-2 text-right text-xs leading-relaxed text-orange-700 dark:text-orange-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {speech.error}
                  </p>
                )}
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={3}
                  placeholder='ספרו מה אכלתם, למשל: "אכלתי 200 גרם חזה עוף וכוס אורז"'
                  className="w-full resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
                />
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() => void analyze(transcript)}
                    disabled={transcript.trim().length < 2}
                    className="btn-primary flex-1 disabled:opacity-40"
                  >
                    נתח עם AI
                  </button>
                  {speech.isSupported && (
                    <button type="button" onClick={() => speech.start()} className="btn-secondary">
                      <Mic className="h-4 w-4" />
                      הקלט
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {stage === 'analyzing' && (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-lime-700 dark:text-lime-400" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">מפענח מה אכלת ומחשב ערכים תזונתיים...</p>
            <p className="max-w-xs text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">"{transcript}"</p>
          </div>
        )}

        {stage === 'error' && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-orange-700 dark:text-orange-400" />
            {isMissingKey ? (
              <>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">ניתוח AI לא מחובר</p>
                <p className="max-w-sm text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
                  שירות ה-AI אינו זמין כרגע. נסו שוב מאוחר יותר.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">הניתוח נכשל</p>
                <p className="max-w-xs text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">{errorMessage}</p>
              </>
            )}
            <div className="flex gap-2">
              {!isMissingKey && (
                <button type="button" onClick={() => void analyze(transcript)} className="btn-primary text-xs">
                  <RotateCw className="h-3.5 w-3.5" />
                  נסה שוב
                </button>
              )}
              <button type="button" onClick={() => { requestRef.current++; setStage('record'); }} className="btn-secondary text-xs">
                ערוך תיאור
              </button>
            </div>
          </div>
        )}

        {stage === 'review' && (
          <div className="flex flex-col gap-4 p-4">
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
              {rows.length === 1 ? 'זיהינו פריט אחד' : `זיהינו ${rows.length} פריטים`}. אפשר לתקן משקל או למחוק פריט לפני השמירה.
            </p>

            <div className="flex flex-col gap-2">
              {rows.map((row, index) => {
                const s = scaled(row);
                return (
                  <div
                    key={row.item.id}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{s.unitLabel ?? row.item.name}</p>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-500">
                        {s.grams > 0 ? `${s.grams} גרם • ` : ''}{s.calories} קק״ל • {s.protein}ח׳ {s.fat}ש׳ {s.carbs}פ׳
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <DecimalInput
                        aria-label={`משקל ${row.item.name} בגרמים`}
                        value={row.gramsInput}
                        onValueChange={(text) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, gramsInput: text } : r)))}
                        className="w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-center text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
                      />
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-500">גר׳</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`מחק ${row.item.name}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              {rows.length === 0 && (
                <p className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-center text-xs text-zinc-600 dark:text-zinc-500">
                  כל הפריטים נמחקו. אפשר להקליט מחדש.
                </p>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 rounded-xl border border-lime-400/30 bg-lime-400/5 p-3 text-center">
              <Total label="קלוריות" value={Math.round(totals.calories)} />
              <Total label="חלבון" value={Math.round(totals.protein)} unit="ג׳" />
              <Total label="פחמימה" value={Math.round(totals.carbs)} unit="ג׳" />
              <Total label="שומן" value={Math.round(totals.fat)} unit="ג׳" />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-500">לאיזו ארוחה לשייך?</p>
              <div className="grid grid-cols-4 gap-2">
                {MEAL_ORDER.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMeal(m)}
                    className={`rounded-lg border py-2 text-xs font-semibold transition ${
                      selectedMeal === m
                        ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                        : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {MEAL_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={handleConfirm} disabled={validRows.length === 0} className="btn-primary flex-1 disabled:opacity-40">
                <Check className="h-4 w-4" />
                הוסף ליומן הארוחות
              </button>
              <button type="button" onClick={restart} className="btn-secondary">
                <Mic className="h-4 w-4" />
                הקלטה מחדש
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Total({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div>
      <p className="text-base font-extrabold text-lime-700 dark:text-lime-400">
        {value}
        {unit && <span className="text-[10px] font-semibold">{unit}</span>}
      </p>
      <p className="text-[10px] text-zinc-600 dark:text-zinc-500">{label}</p>
    </div>
  );
}
