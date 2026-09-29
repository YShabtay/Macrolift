import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, RotateCw, Sparkles, X } from 'lucide-react';
import type { FoodEntry, Meal } from '../types/fitness';
import { MEAL_LABELS, MEAL_ORDER } from '../utils/nutritionLog';
import { fileToBase64, MissingApiKeyError, scanMealImage, type FoodScanResult } from '../services/aiFoodScanner';

type ScanStatus = 'analyzing' | 'review' | 'error';

interface MealScanModalProps {
  meal: Meal;
  file: File;
  date: string;
  onClose: () => void;
  onConfirm: (entry: Omit<FoodEntry, 'id'>) => void;
}

export default function MealScanModal({ meal: initialMeal, file, date, onClose, onConfirm }: MealScanModalProps) {
  const [status, setStatus] = useState<ScanStatus>('analyzing');
  const [isMissingKey, setIsMissingKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<FoodScanResult | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal>(initialMeal);

  const [name, setName] = useState('');
  const [weightGrams, setWeightGrams] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [fatG, setFatG] = useState('');
  const [carbsG, setCarbsG] = useState('');

  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus('analyzing');
      setIsMissingKey(false);
      try {
        const { base64, mimeType } = await fileToBase64(file);
        const scanResult = await scanMealImage(base64, mimeType);
        if (cancelled) return;
        setResult(scanResult);
        setName(scanResult.foodName);
        setWeightGrams(String(scanResult.estimatedWeightGrams));
        setCalories(String(scanResult.calories));
        setProteinG(String(scanResult.protein));
        setFatG(String(scanResult.fats));
        setCarbsG(String(scanResult.carbs));
        setStatus('review');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof MissingApiKeyError) {
          setIsMissingKey(true);
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'הניתוח נכשל, נסו שוב.');
        }
        setStatus('error');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [file, retryToken]);

  function handleConfirm() {
    const cal = Number(calories);
    if (!name.trim() || Number.isNaN(cal) || cal < 0) return;
    onConfirm({
      date,
      meal: selectedMeal,
      name: name.trim(),
      quantity: weightGrams.trim() ? `${weightGrams.trim()} גרם` : 'מנה אחת',
      weightGrams: weightGrams.trim() ? Number(weightGrams) : undefined,
      calories: cal,
      proteinG: Number(proteinG) || 0,
      fatG: Number(fatG) || 0,
      carbsG: Number(carbsG) || 0,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">סריקת ארוחה חכמה</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isMissingKey && (
          <div className="relative h-36 w-full shrink-0 overflow-hidden">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 to-transparent" />
          </div>
        )}

        {status === 'analyzing' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-lime-700 dark:text-lime-400" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">מנתח את המנה שלך בעזרת AI...</p>
            <div className="flex w-full max-w-xs flex-col gap-2">
              <div className="h-3 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-3/4 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        )}

        {status === 'error' &&
          (isMissingKey ? (
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

        {status === 'review' && result && (
          <div className="flex flex-col gap-4 p-4">
            {result.confidence !== 'high' && (
              <div className="flex items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-400/5 px-3 py-2 text-xs leading-relaxed text-orange-700 dark:text-orange-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                רמת הביטחון בזיהוי {result.confidence === 'low' ? 'נמוכה' : 'בינונית'} - מומלץ לבדוק ולתקן את הערכים
                לפני השמירה.
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">שם המנה</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <NumberField label="משקל משוער (גר׳)" value={weightGrams} onChange={setWeightGrams} />
              <NumberField label="קלוריות" value={calories} onChange={setCalories} />
              <NumberField label="חלבון (גר׳)" value={proteinG} onChange={setProteinG} />
              <NumberField label="שומן (גר׳)" value={fatG} onChange={setFatG} />
              <NumberField label="פחמימה (גר׳)" value={carbsG} onChange={setCarbsG} />
            </div>

            {result.breakdown.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-500">מרכיבים שזוהו</p>
                <div className="flex flex-col gap-1.5">
                  {result.breakdown.map((b, i) => (
                    <div
                      key={`${b.item}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white/60 dark:bg-zinc-900/60 px-3 py-2 text-xs"
                    >
                      <span className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">
                        {b.item} <span className="text-zinc-500 dark:text-zinc-500">· {b.amount}</span>
                      </span>
                      <span className="shrink-0 text-zinc-600 dark:text-zinc-400">
                        {b.calories} קק״ל · {b.protein}ח׳
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            <button type="button" onClick={handleConfirm} className="btn-primary">
              <Check className="h-4 w-4" />
              הוסף למעקב היומי
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
      />
    </div>
  );
}

function MissingApiKeyNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-orange-700 dark:text-orange-400" />
      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">סריקת AI לא מחוברת</p>
      <p className="max-w-sm text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
        כדי להפעיל את הסריקה, יש להגדיר מפתח API של Gemini (מתוך Google AI Studio) במשתנה הסביבה{' '}
        <code className="rounded bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300">VITE_GEMINI_API_KEY</code> בקובץ{' '}
        <code className="rounded bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300">.env.local</code>, ולהפעיל מחדש את השרת.
      </p>
    </div>
  );
}
