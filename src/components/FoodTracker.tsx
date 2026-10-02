import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Beef,
  Camera,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Cookie,
  Droplet,
  Moon,
  Plus,
  Sun,
  Trash2,
  UtensilsCrossed,
  Wheat,
  X,
} from 'lucide-react';
import type { FoodEntry, FoodPer100g, Meal, NutritionPlan } from '../types/fitness';
import HeroCarousel from './HeroCarousel';
import MealScanModal from './MealScanModal';
import { QUICK_FOODS } from '../data/commonFoods';
import { FoodSearch, ServingPanel } from './FoodSearch';
import { calculateRemaining, getEntriesForDate, MEAL_LABELS, MEAL_ORDER, sumTotals } from '../utils/nutritionLog';
import { formatDateDisplay, parseIsoDate, todayIso } from '../utils/weightCalculations';

// Nutrition-tab-only header photo (gym/workout imagery is reserved for the dashboard hero).
const NUTRITION_HEADER_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=80';

const MEAL_ICONS: Record<Meal, typeof Coffee> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snacks: Cookie,
};

interface FoodTrackerProps {
  foodLog: FoodEntry[];
  nutritionPlan: NutritionPlan;
  onAddFood: (entry: Omit<FoodEntry, 'id'>) => void;
  onDeleteFood: (id: string) => void;
}

function shiftDate(dateStr: string, days: number): string {
  const d = parseIsoDate(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function FoodTracker({ foodLog, nutritionPlan, onAddFood, onDeleteFood }: FoodTrackerProps) {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [addingMeal, setAddingMeal] = useState<Meal | null>(null);
  const [scanRequest, setScanRequest] = useState<{ meal: Meal; file: File } | null>(null);
  const pendingScanMealRef = useRef<Meal | null>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  const today = todayIso();

  function handleScanClick(meal: Meal) {
    pendingScanMealRef.current = meal;
    scanFileInputRef.current?.click();
  }

  function handleScanFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    const meal = pendingScanMealRef.current;
    pendingScanMealRef.current = null;
    if (file && meal) setScanRequest({ meal, file });
  }

  const entriesForDate = useMemo(() => getEntriesForDate(foodLog, selectedDate), [foodLog, selectedDate]);
  const eaten = useMemo(() => sumTotals(entriesForDate), [entriesForDate]);
  const remaining = useMemo(
    () => calculateRemaining(nutritionPlan.targetCalories, nutritionPlan.macros, eaten),
    [nutritionPlan, eaten],
  );

  return (
    <div className="flex flex-col gap-5">
      <HeroCarousel
        compact
        slides={[
          {
            id: 'nutrition-header',
            imageUrl: NUTRITION_HEADER_IMAGE,
            eyebrow: 'יומן תזונה',
            headline: 'הדלק של הגוף שלך',
            body: 'תיעוד ארוחות ומעקב יתרת קלוריות ומאקרו בזמן אמת',
          },
        ]}
      />

      <div className="glass-card flex items-center justify-between p-3">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
          aria-label="יום קודם"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="text-center">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {selectedDate === today ? 'היום' : formatDateDisplay(selectedDate)}
          </p>
          {selectedDate !== today && (
            <button type="button" onClick={() => setSelectedDate(today)} className="text-[11px] text-lime-700 dark:text-lime-400">
              חזרה להיום
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
          disabled={selectedDate >= today}
          aria-label="יום הבא"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <SummaryCard targetCalories={nutritionPlan.targetCalories} targetMacros={nutritionPlan.macros} eaten={eaten} remaining={remaining} />

      <div className="flex flex-col gap-4">
        {MEAL_ORDER.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={entriesForDate.filter((e) => e.meal === meal)}
            onAdd={() => setAddingMeal(meal)}
            onScan={() => handleScanClick(meal)}
            onDelete={onDeleteFood}
          />
        ))}
      </div>

      {/* Hidden input drives both the file picker and, on mobile, the device camera. */}
      <input
        ref={scanFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleScanFileSelected}
      />

      {addingMeal &&
        createPortal(
          <AddFoodModal
            meal={addingMeal}
            date={selectedDate}
            onAdd={onAddFood}
            onClose={() => setAddingMeal(null)}
          />,
          document.body,
        )}

      {scanRequest &&
        createPortal(
          <MealScanModal
            meal={scanRequest.meal}
            file={scanRequest.file}
            date={selectedDate}
            onConfirm={onAddFood}
            onClose={() => setScanRequest(null)}
          />,
          document.body,
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({
  targetCalories,
  targetMacros,
  eaten,
  remaining,
}: {
  targetCalories: number;
  targetMacros: { proteinG: number; fatG: number; carbsG: number };
  eaten: { calories: number; proteinG: number; fatG: number; carbsG: number };
  remaining: { calories: number; proteinG: number; fatG: number; carbsG: number };
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
      <CalorieRing target={targetCalories} eaten={eaten.calories} remaining={remaining.calories} />
      <div className="flex w-full flex-1 flex-col gap-3">
        <MacroRemainingBar
          icon={Beef}
          label="חלבון"
          color="#a3e635"
          targetG={targetMacros.proteinG}
          remainingG={remaining.proteinG}
        />
        <MacroRemainingBar
          icon={Droplet}
          label="שומן"
          color="#fb923c"
          targetG={targetMacros.fatG}
          remainingG={remaining.fatG}
        />
        <MacroRemainingBar
          icon={Wheat}
          label="פחמימה"
          color="#a1a1aa"
          targetG={targetMacros.carbsG}
          remainingG={remaining.carbsG}
        />
      </div>
    </div>
  );
}

function CalorieRing({ target, eaten, remaining }: { target: number; eaten: number; remaining: number }) {
  const progress = target > 0 ? Math.min(eaten / target, 1) : 0;
  const isOver = remaining < 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={isOver ? '#fb923c' : '#a3e635'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-extrabold ${isOver ? 'text-orange-700 dark:text-orange-400' : 'text-lime-700 dark:text-lime-400'}`}>
          {Math.abs(remaining)}
        </span>
        <span className="text-[10px] leading-tight text-zinc-600 dark:text-zinc-500">{isOver ? 'חריגה קק״ל' : 'נשארו קק״ל'}</span>
        <span className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-600">
          {eaten}/{target}
        </span>
      </div>
    </div>
  );
}

function MacroRemainingBar({
  icon: Icon,
  label,
  color,
  targetG,
  remainingG,
}: {
  icon: typeof Beef;
  label: string;
  color: string;
  targetG: number;
  remainingG: number;
}) {
  const isOver = remainingG < 0;
  const eatenG = targetG - remainingG;
  const progressPercent = targetG > 0 ? Math.min((eatenG / targetG) * 100, 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          {label}
        </span>
        <span className={`font-semibold ${isOver ? 'text-orange-700 dark:text-orange-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
          {isOver ? `חריגה ${Math.abs(remainingG)} גר׳` : `נותרו ${remainingG} גר׳`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${isOver ? 100 : progressPercent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meal section
// ---------------------------------------------------------------------------

function MealSection({
  meal,
  entries,
  onAdd,
  onScan,
  onDelete,
}: {
  meal: Meal;
  entries: FoodEntry[];
  onAdd: () => void;
  onScan: () => void;
  onDelete: (id: string) => void;
}) {
  const mealCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const MealIcon = MEAL_ICONS[meal];

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
            <MealIcon className="h-4 w-4" />
          </span>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{MEAL_LABELS[meal]}</h3>
          {mealCalories > 0 && <span className="text-xs text-zinc-600 dark:text-zinc-500">{mealCalories} קק״ל</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onScan}
            aria-label="סרוק ארוחה במצלמה"
            title="סרוק ארוחה במצלמה"
            className="flex items-center gap-1 rounded-lg border border-lime-400/40 bg-lime-400/10 px-2.5 py-1.5 text-xs font-semibold text-lime-700 dark:text-lime-400 transition hover:border-lime-400/70 hover:bg-lime-400/20"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">סריקת AI</span>
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
          >
            <Plus className="h-3.5 w-3.5" />
            הוספה
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-600">לא נרשמו פריטים</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-lg bg-white/60 dark:bg-zinc-900/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{entry.name}</p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-500">
                  {entry.quantity} &middot; {entry.calories} קק״ל &middot; {entry.proteinG}ח׳ {entry.fatG}ש׳{' '}
                  {entry.carbsG}פ׳
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                aria-label="מחיקה"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add food modal
// ---------------------------------------------------------------------------

function AddFoodModal({
  meal,
  date,
  onAdd,
  onClose,
}: {
  meal: Meal;
  date: string;
  onAdd: (entry: Omit<FoodEntry, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [fatG, setFatG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [pickedFood, setPickedFood] = useState<FoodPer100g | null>(null);

  function handleQuickAdd(item: (typeof QUICK_FOODS)[number]) {
    onAdd({
      date,
      meal,
      name: item.name,
      quantity: item.quantity,
      calories: item.calories,
      proteinG: item.proteinG,
      fatG: item.fatG,
      carbsG: item.carbsG,
    });
    onClose();
  }

  function handleManualAdd() {
    const cal = Number(calories);
    if (!name.trim() || Number.isNaN(cal) || cal < 0) return;
    onAdd({
      date,
      meal,
      name: name.trim(),
      quantity: quantity.trim() || '1 מנה',
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
        className="glass-card neon-border flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">הוספת מזון - {MEAL_LABELS[meal]}</h3>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {pickedFood && (
          <div className="p-4">
            <ServingPanel
              food={pickedFood}
              meal={meal}
              date={date}
              onBack={() => setPickedFood(null)}
              onAdd={onAdd}
              onDone={onClose}
            />
          </div>
        )}

        {/* Kept mounted (just hidden) while a food is picked, so the search text and results survive "back to search". */}
        <div className={`flex-col gap-4 p-4 ${pickedFood ? 'hidden' : 'flex'}`}>
          <FoodSearch onPick={setPickedFood} />

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <p className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-500">פריטים נפוצים</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_FOODS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleQuickAdd(item)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-2.5 text-right transition hover:border-lime-400/50"
                >
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{item.name}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600 dark:text-zinc-500">
                    {item.quantity} &middot; {item.calories} קק״ל
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-500">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              הזנה ידנית
            </p>
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="שם המזון"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                />
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="כמות (למשל 100 גרם)"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  placeholder="קק״ל"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  placeholder="חלבון"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  placeholder="שומן"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  placeholder="פחמימה"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                />
              </div>
              <button type="button" onClick={handleManualAdd} className="btn-primary">
                <Plus className="h-4 w-4" />
                הוספה ליומן
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
