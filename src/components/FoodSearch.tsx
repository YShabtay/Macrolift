import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Loader2, Plus, Search, Sparkles } from 'lucide-react';
import type { FoodEntry, FoodPer100g, Meal } from '../types/fitness';
import { COMMON_FOODS } from '../data/commonFoods';
import { hasGeminiApiKey } from '../services/geminiChat';
import { lookupAndCacheFood } from '../services/foodLookup';
import { storageService } from '../services/storageService';
import { normalizeFoodQuery, scaleNutrition, searchFoods } from '../utils/foodSearch';
import DecimalInput from './DecimalInput';
import { formatServingQuantity, formatUnitCount, getScannedDefault, shouldDefaultToUnits, unitsToGrams } from '../utils/servingUnits';
import { saveBarcodePackSize } from '../services/barcodeLookup';
import type { ServingUnit } from '../types/fitness';
import { MEAL_LABELS } from '../utils/nutritionLog';

const AUTO_AI_DELAY_MS = 900;
const QUICK_GRAMS = [100, 150, 200];
const QUICK_UNIT_COUNTS = [1, 2, 3];

interface FoodSearchProps {
  onPick: (food: FoodPer100g) => void;
}

/** Search box over the offline database + previously AI-looked-up foods, with a Gemini fallback for anything missing. */
export function FoodSearch({ onPick }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [customFoods, setCustomFoods] = useState<FoodPer100g[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const attemptedRef = useRef<Set<string>>(new Set());
  const latestQueryRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    storageService.getCustomFoods().then((foods) => {
      if (!cancelled) setCustomFoods(foods);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => searchFoods(query, [...customFoods, ...COMMON_FOODS]), [query, customFoods]);
  const normalizedQuery = normalizeFoodQuery(query);
  const showNoResults = normalizedQuery.length >= 2 && results.length === 0;

  async function runAiLookup(rawQuery: string) {
    const requested = normalizeFoodQuery(rawQuery);
    attemptedRef.current.add(requested);
    setIsLookingUp(true);
    setAiError(null);
    try {
      const food = await lookupAndCacheFood(rawQuery);
      setCustomFoods((prev) => [food, ...prev.filter((f) => f.id !== food.id)]);
      // Only jump straight to the serving panel if the user hasn't kept typing something else meanwhile.
      if (latestQueryRef.current === requested) onPick(food);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'החיפוש עם AI נכשל');
    } finally {
      setIsLookingUp(false);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setAiError(null);
    latestQueryRef.current = normalizeFoodQuery(value);
  }

  // Automatic fallback: once typing pauses on a query nothing local matches, ask AI (once per distinct query).
  useEffect(() => {
    if (!showNoResults || !hasGeminiApiKey || isLookingUp || attemptedRef.current.has(normalizedQuery)) return;
    const timer = setTimeout(() => void runAiLookup(query), AUTO_AI_DELAY_MS);
    return () => clearTimeout(timer);
    // runAiLookup only closes over stable refs/setters; re-running on its identity would reset the debounce every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNoResults, normalizedQuery, isLookingUp, query]);

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-500">
        <Search className="h-3.5 w-3.5" />
        חיפוש מזון
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && normalizedQuery.length >= 2 && !isLookingUp && results.length === 0) {
              void runAiLookup(query);
            }
          }}
          placeholder="לדוגמה: חזה עוף, אורז, סושי, פיצה..."
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2.5 pe-3 ps-9 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
        />
      </div>

      {results.length > 0 && (
        <ul className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {results.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => onPick(food)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-3 py-2 text-right transition hover:border-lime-400/50"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {food.name}
                    {food.fromAI && <Sparkles className="h-3 w-3 shrink-0 text-lime-700 dark:text-lime-400" aria-label="נשמר מחיפוש AI" />}
                  </span>
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-500">
                    ח׳ {food.protein} · פ׳ {food.carbs} · ש׳ {food.fat}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold text-zinc-700 dark:text-zinc-300">{food.calories} קק״ל</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {isLookingUp && (
        <p className="mt-2 flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-lime-700 dark:text-lime-400" />
          מחפש ערכים תזונתיים עם AI...
        </p>
      )}

      {aiError && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{aiError}</p>}

      {showNoResults && !isLookingUp && !hasGeminiApiKey && (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-500">
          לא נמצא במאגר. כדי לחפש כל מאכל באמצעות AI יש להגדיר מפתח Gemini, או להזין ידנית למטה.
        </p>
      )}

      {normalizedQuery.length >= 2 && !isLookingUp && hasGeminiApiKey && (
        <button
          type="button"
          onClick={() => void runAiLookup(query)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-lime-400/50 bg-lime-400/5 py-2.5 text-xs font-bold text-lime-700 transition hover:bg-lime-400/10 dark:text-lime-400"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {results.length === 0 ? `לא נמצא במאגר - חפש "${query.trim()}" עם AI` : 'לא מצאת? חפש עם AI'}
        </button>
      )}
    </div>
  );
}

interface ServingPanelProps {
  food: FoodPer100g;
  meal: Meal;
  date: string;
  onBack: () => void;
  onAdd: (entry: Omit<FoodEntry, 'id'>) => void;
  onDone: () => void;
  /** For a scanned product: start with a ready amount (one serving, else one pack, else 100 g) so the values are already filled in. */
  prefillAmount?: boolean;
}

/** Gram-based entry for one chosen food: per-100g reference values, quick-gram buttons and live macro math. */
export function ServingPanel({ food, meal, date, onBack, onAdd, onDone, prefillAmount = false }: ServingPanelProps) {
  // A pack size the user adds from the label joins the units the database already gave.
  const [addedPack, setAddedPack] = useState<ServingUnit | null>(null);
  const [packText, setPackText] = useState('');
  const units = addedPack ? [...(food.servingUnits ?? []).filter((u) => u.name !== addedPack.name), addedPack] : food.servingUnits;
  const startsInUnits = shouldDefaultToUnits(units);
  const scannedDefault = prefillAmount ? getScannedDefault(food.servingUnits) : null;
  const canAddPack = prefillAmount && !(food.servingUnits ?? []).some((u) => u.name === 'אריזה' || u.name === 'מנה') && !addedPack;
  const packGrams = Number(packText);
  const isPackValid = Number.isFinite(packGrams) && packGrams >= 5 && packGrams <= 5000;

  function handleSavePack() {
    if (!isPackValid) return;
    const pack: ServingUnit = { name: 'אריזה', grams: packGrams };
    setAddedPack(pack);
    setUnitName(pack.name);
    setAmountText('1');
    setHasEdited(true);
    void saveBarcodePackSize(food.id, packGrams);
  }
  // '' = grams; otherwise the name of the selected serving unit.
  const [unitName, setUnitName] = useState(scannedDefault ? scannedDefault.unitName : startsInUnits && units ? units[0].name : '');
  // Searched foods start empty (shown as 0): a pre-filled 100 / 1 looked like an amount the user had already chosen and was easy to add by mistake.
  // A scanned product is different - the user just pointed the camera at the thing they ate - so it starts with one serving, ready to add or change.
  const [amountText, setAmountText] = useState(scannedDefault ? scannedDefault.amountText : '');
  const [hasEdited, setHasEdited] = useState(false);
  const selectedUnit = units?.find((u) => u.name === unitName);

  const amount = Number(amountText);
  const grams = selectedUnit ? unitsToGrams(amount, selectedUnit) : amount;
  const isValid = Number.isFinite(amount) && amount > 0 && Number.isFinite(grams) && grams > 0 && grams <= 5000;
  const scaled = scaleNutrition(food, isValid ? grams : 0);
  const quickAmounts = selectedUnit ? QUICK_UNIT_COUNTS : QUICK_GRAMS;

  function selectUnit(next: string) {
    if (next === unitName) return;
    setUnitName(next);
    setAmountText('');
    setHasEdited(true);
  }

  function handleAdd() {
    if (!isValid) return;
    onAdd({
      date,
      meal,
      name: food.name,
      quantity: selectedUnit ? formatServingQuantity(amount, selectedUnit) : `${grams} גרם`,
      weightGrams: grams,
      calories: scaled.calories,
      proteinG: scaled.protein,
      fatG: scaled.fat,
      carbsG: scaled.carbs,
    });
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-xs font-semibold text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        חזרה לחיפוש
      </button>

      <div>
        <h4 className="flex items-center gap-1.5 text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {food.name}
          {food.fromAI && <Sparkles className="h-4 w-4 text-lime-700 dark:text-lime-400" />}
        </h4>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-500">
          ל-100 גרם: {food.calories} קק״ל · חלבון {food.protein} · פחמימה {food.carbs} · שומן {food.fat}
        </p>
        {food.fromAI && (
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">ערכים ממוצעים שהוערכו על ידי AI - נשמר במכשיר לחיפושים הבאים.</p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-500">{selectedUnit ? `כמות (${selectedUnit.name})` : 'כמות בגרמים'}</label>
          {units && units.length > 0 && (
            <div role="group" aria-label="יחידת מידה" className="flex flex-wrap gap-1">
              {[{ name: '', label: 'גרם' }, ...units.map((u) => ({ name: u.name, label: u.name }))].map((opt) => (
                <button
                  key={opt.name || 'grams'}
                  type="button"
                  aria-pressed={unitName === opt.name}
                  onClick={() => selectUnit(opt.name)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                    unitName === opt.name
                      ? 'border-lime-400/60 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <DecimalInput
            aria-label={selectedUnit ? `כמות ב${selectedUnit.name}` : 'כמות בגרמים'}
            value={amountText}
            onValueChange={(v) => {
              setAmountText(v);
              setHasEdited(true);
            }}
            placeholder="0"
            className={`w-28 rounded-xl border bg-white dark:bg-zinc-900 px-3 py-2.5 text-center text-lg font-bold text-zinc-900 dark:text-zinc-100 outline-none transition focus:ring-2 ${
              isValid || amountText.trim() === ''
                ? 'border-zinc-300 dark:border-zinc-700 focus:border-lime-400 focus:ring-lime-400/20'
                : 'border-orange-400/60 focus:border-orange-400 focus:ring-orange-400/20'
            }`}
          />
          <div className="flex flex-1 gap-2">
            {quickAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setAmountText(String(q));
                  setHasEdited(true);
                }}
                className={`flex-1 rounded-xl border text-xs font-bold transition ${
                  amount === q
                    ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                {selectedUnit ? q : `${q} גרם`}
              </button>
            ))}
          </div>
        </div>
        {scannedDefault && !hasEdited && (
          <p className="mt-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
            התחלנו מ{scannedDefault.label}. לכמות אחרת, הקלידו אותה בשדה או בחרו מהכפתורים.
          </p>
        )}
        {selectedUnit && isValid && (
          <p className="mt-1.5 text-xs font-semibold text-lime-700 dark:text-lime-400">
            {formatUnitCount(amount, selectedUnit)} (~{grams} גרם)
          </p>
        )}
        {!isValid && amountText.trim() !== '' && (
          <p className="mt-1 text-[11px] text-orange-700 dark:text-orange-400">
            {selectedUnit ? 'יש להזין כמות חיובית (עד 5000 גרם בסך הכל)' : 'יש להזין כמות בין 1 ל-5000 גרם'}
          </p>
        )}
      </div>

      {canAddPack && (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">לא יודעים כמה גרם? אוכלים אריזה שלמה?</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            הזינו פעם אחת את המשקל שכתוב על האריזה, ובפעם הבאה תוכלו פשוט לרשום &quot;אריזה אחת&quot;.
          </p>
          <div className="mt-2 flex gap-2">
            <DecimalInput
              aria-label="משקל האריזה בגרמים"
              value={packText}
              onValueChange={setPackText}
              placeholder="משקל האריזה בגרמים"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
            />
            <button
              type="button"
              onClick={handleSavePack}
              disabled={!isPackValid}
              className="rounded-lg border border-lime-400/50 bg-lime-400/10 px-4 text-xs font-bold text-lime-700 transition disabled:opacity-40 dark:text-lime-400"
            >
              שמור
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 text-center">
        <MacroCell label="קק״ל" value={scaled.calories} accent />
        <MacroCell label="חלבון" value={scaled.protein} unit="גר׳" />
        <MacroCell label="פחמימה" value={scaled.carbs} unit="גר׳" />
        <MacroCell label="שומן" value={scaled.fat} unit="גר׳" />
      </div>

      <button type="button" onClick={handleAdd} disabled={!isValid} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40">
        <Plus className="h-4 w-4" />
        הוסף לארוחה · {MEAL_LABELS[meal]}
      </button>
    </div>
  );
}

function MacroCell({ label, value, unit, accent }: { label: string; value: number; unit?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-2.5">
      <p className="text-[11px] text-zinc-600 dark:text-zinc-500">{label}</p>
      <p className={`text-base font-extrabold tabular-nums ${accent ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
        {unit && <span className="mr-0.5 text-[10px] font-medium text-zinc-500">{unit}</span>}
      </p>
    </div>
  );
}
