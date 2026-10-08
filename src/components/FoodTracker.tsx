import { useMemo, useState } from 'react';
import { useToday } from '../hooks/useToday';
import CalorieAdjustControl from './CalorieAdjustControl';
import { createPortal } from 'react-dom';
import {
  Beef,
  BookmarkPlus,
  Camera,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Cookie,
  Copy,
  Droplet,
  Mic,
  Moon,
  Pencil,
  Plus,
  ScanBarcode,
  Star,
  Sun,
  Trash2,
  UtensilsCrossed,
  Wheat,
  X,
} from 'lucide-react';
import type { FavoriteFood, FoodEntry, FoodPer100g, FoodTemplate, Meal, NutritionPlan, SavedMeal, StepLog, UserMetrics, WeeklyBalanceAdjustment } from '../types/fitness';
import QuickFoodShortcuts from './QuickFoodShortcuts';
import WeekStrip, { type WeekStripDay } from './WeekStrip';
import WeeklyCalorieCard from './WeeklyCalorieCard';
import DateField from './DateField';
import { getWeeklyCalorieBudget } from '../utils/calorieBudget';
import BarcodeScanner from './BarcodeScanner';
import BarcodeIntro from './BarcodeIntro';
import { hasSeenBarcodeIntro, markBarcodeIntroSeen } from '../utils/barcodeIntro';
import { copyMealEntries, findFavorite, getRecentFoods, templateToEntry } from '../utils/foodShortcuts';
import { getDailyTargets } from '../utils/weeklyBalance';
import { getStepCredit } from '../utils/stepCredit';
import { describeCoverage, describeRoom, getOvershootCoverage } from '../utils/overshoot';
import { describeStepSurplus, getStepSurplus } from '../utils/stepSurplus';
import BalancedRing from './BalancedRing';
import { describeRangeShort, getCalorieRange } from '../utils/calorieRange';
import HeroCarousel from './HeroCarousel';
import MealScanModal from './MealScanModal';
import { QUICK_FOODS } from '../data/commonFoods';
import { FoodSearch, ServingPanel } from './FoodSearch';
import PhotoSourceSheet from './PhotoSourceSheet';
import VoiceMealModal from './VoiceMealModal';
import Toast from './Toast';
import DecimalInput from './DecimalInput';
import EditMealModal from './EditMealModal';
import PwaInstallBanner from './PwaInstallBanner';
import { useInstallBanner } from '../hooks/useInstallBanner';
import { parseDecimal } from '../utils/decimalInput';
import { calculateRemaining, getEntriesForDate, getEntryTitle, getMealForCurrentTime, MEAL_LABELS, MEAL_ORDER, sumTotals } from '../utils/nutritionLog';
import { formatDateDisplay, parseIsoDate } from '../utils/weightCalculations';
import { formatMacro } from '../utils/formatMacro';

// Nutrition-tab-only header photo (gym/workout imagery is reserved for the dashboard hero).

const MEAL_ICONS: Record<Meal, typeof Coffee> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snacks: Cookie,
};

interface FoodTrackerProps {
  foodLog: FoodEntry[];
  nutritionPlan: NutritionPlan;
  /** Temporary weekly rebalance, which can lower the target on the days it covers. */
  weeklyBalance?: WeeklyBalanceAdjustment;
  /** Step history and the base daily step goal: steps walked above the goal count against a day's overshoot. */
  stepLogs: StepLog[];
  baseStepGoal: number;
  weightKg: number;
  /** The profile, for the manual calorie adjustment, and what applies it (adds kcal to the daily target; negative removes). */
  metrics: UserMetrics;
  onApplyTargetAdjustment: (deltaKcal: number) => void;
  /** Opens the screen where an overshoot can be rebalanced. */
  onOpenRebalance: () => void;
  onAddFood: (entry: Omit<FoodEntry, 'id'>) => void;
  favoriteFoods: FavoriteFood[];
  savedMeals: SavedMeal[];
  onToggleFavorite: (food: FoodEntry | FoodTemplate) => void;
  onSaveMeal: (name: string, entries: FoodEntry[]) => void;
  onDeleteSavedMeal: (id: string) => void;
  onDeleteFood: (id: string) => void;
  /** Saves changes to an already logged item (weight / amount, macros, name). */
  onUpdateFood: (id: string, updates: Partial<Omit<FoodEntry, 'id' | 'date' | 'meal'>>) => void;
  /** Opens the add-to-home-screen guide (shown from the "keep your data" banner). */
  onOpenInstallGuide: () => void;
}

function shiftDate(dateStr: string, days: number): string {
  const d = parseIsoDate(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function FoodTracker({ foodLog, nutritionPlan, weeklyBalance, stepLogs, baseStepGoal, weightKg, metrics, onApplyTargetAdjustment, onOpenRebalance, onAddFood, favoriteFoods, savedMeals, onToggleFavorite, onSaveMeal, onDeleteSavedMeal, onDeleteFood, onUpdateFood, onOpenInstallGuide }: FoodTrackerProps) {
  const installBanner = useInstallBanner();
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const today = useToday();
  // Following "today" (null) rather than a fixed date: a screen left open past midnight moves on to the new day by itself instead of
  // staying on yesterday, which would be judged as a finished day.
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const selectedDate = pickedDate ?? today;
  const setSelectedDate = (next: string | ((current: string) => string)) => {
    const date = typeof next === 'function' ? next(selectedDate) : next;
    setPickedDate(date >= today ? null : date);
  };
  const [addingMeal, setAddingMeal] = useState<Meal | null>(null);
  const [scanRequest, setScanRequest] = useState<{ meal: Meal; file: File } | null>(null);
  const [scanSourceMeal, setScanSourceMeal] = useState<Meal | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const entriesForDate = useMemo(() => getEntriesForDate(foodLog, selectedDate), [foodLog, selectedDate]);
  const recentFoods = useMemo(() => getRecentFoods(foodLog), [foodLog]);
  // The week's walking against the step goal, in calories: the same number the coverage check uses, so every card moves together.
  const stepCreditKcal = useMemo(
    () => getStepCredit({ stepLogs, baseGoal: baseStepGoal, adjustment: weeklyBalance, asOf: today }).netKcal,
    [stepLogs, baseStepGoal, weeklyBalance, today],
  );
  // Over how many of the days left to use a positive step credit (null = all of them); a view choice, so it is not stored.
  const [creditSpreadDays, setCreditSpreadDays] = useState<number | null>(null);
  const calorieBudget = useMemo(
    () => getWeeklyCalorieBudget(foodLog, nutritionPlan, weeklyBalance, selectedDate, today, stepCreditKcal, creditSpreadDays ?? undefined),
    [foodLog, nutritionPlan, weeklyBalance, selectedDate, today, stepCreditKcal, creditSpreadDays],
  );
  const stripDay = (date: string): WeekStripDay => {
    const entries = getEntriesForDate(foodLog, date);
    if (entries.length === 0) return { kcal: null, status: 'none' };
    const kcal = Math.round(sumTotals(entries).calories);
    const target = getDailyTargets(nutritionPlan, weeklyBalance, date).calories;
    return { kcal, status: kcal > target * 1.1 ? 'over' : kcal < target * 0.9 ? 'under' : 'on-target' };
  };
  const eaten = useMemo(() => sumTotals(entriesForDate), [entriesForDate]);
  const targets = useMemo(() => getDailyTargets(nutritionPlan, weeklyBalance, selectedDate), [nutritionPlan, weeklyBalance, selectedDate]);
  const remaining = useMemo(() => calculateRemaining(targets.calories, targets.macros, eaten), [targets, eaten]);
  // A day is judged against its week as it stood at the end of that day, so yesterday still reads "balanced" after midnight if it was
  // covered. Only today can be rebalanced and gets the "room left" line, because both look forward.
  const isToday = selectedDate === today;
  const coverage = useMemo(
    () => getOvershootCoverage({ foodLog, plan: nutritionPlan, adjustment: weeklyBalance, stepLogs, baseStepGoal, today: selectedDate, realToday: today }),
    [selectedDate, today, foodLog, nutritionPlan, weeklyBalance, stepLogs, baseStepGoal],
  );
  const isCovered = remaining.calories < 0 && !!coverage?.isCovered;
  const stepSurplus = useMemo(
    () => (isToday ? getStepSurplus({ stepLogs, goalSteps: baseStepGoal, weightKg, today }) : null),
    [isToday, today, stepLogs, baseStepGoal, weightKg],
  );

  return (
    <div className="flex flex-col gap-5">
      <HeroCarousel
        compact
        slides={[
          {
            id: 'nutrition-header',
            eyebrow: 'יומן תזונה',
            headline: 'הדלק של הגוף שלך',
            body: 'תיעוד ארוחות ומעקב יתרת קלוריות ומאקרו בזמן אמת',
          },
        ]}
      />

      {installBanner.isVisible && foodLog.length > 0 && (
        <PwaInstallBanner variant="has-data" onOpen={onOpenInstallGuide} onDismiss={installBanner.dismiss} />
      )}

      <div className="glass-card flex items-center justify-between p-3">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
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
          onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
          disabled={selectedDate >= today}
          aria-label="יום הבא"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="glass-card flex flex-col gap-2 p-3">
        <WeekStrip selectedDate={selectedDate} today={today} getDay={stripDay} onSelect={setSelectedDate} />
        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-2">
          <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">לקפוץ לתאריך אחר:</span>
          <DateField
            value={selectedDate}
            max={today}
            onChange={setSelectedDate}
            ariaLabel="בחירת תאריך ביומן התזונה"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
          />
        </div>
      </div>

      {getCalorieRange(nutritionPlan) && targets.reductionKcal === 0 && selectedDate === today && (
        <p className="-mb-2 text-center text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">{describeRangeShort(getCalorieRange(nutritionPlan)!)}</p>
      )}
      {isToday && (
        <div className="-mb-2 flex justify-center">
          <CalorieAdjustControl metrics={metrics} onApply={onApplyTargetAdjustment} />
        </div>
      )}
      <SummaryCard targetCalories={targets.calories} targetMacros={targets.macros} eaten={eaten} remaining={remaining} covered={isCovered} />

      {isCovered && coverage && (
        <p className="rounded-xl border border-lime-400/30 bg-lime-400/5 px-4 py-3 text-xs font-semibold leading-relaxed text-lime-700 dark:text-lime-400">
          מאוזן: עברת את היעד ב-{Math.abs(Math.round(remaining.calories))} קק״ל, אבל {describeCoverage(coverage)}. {isToday && describeRoom(coverage)} {isToday && 'אין צורך באיזון.'}
        </p>
      )}
      {stepSurplus && (
        <p className="rounded-xl border border-lime-400/30 bg-lime-400/5 px-4 py-3 text-xs font-semibold leading-relaxed text-lime-700 dark:text-lime-400">
          {describeStepSurplus(stepSurplus, coverage.overshootKcal)}
        </p>
      )}
      {isToday && !isCovered && coverage.overshootKcal > 0 && (
        <button
          type="button"
          onClick={onOpenRebalance}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2.5 text-center text-xs font-bold leading-snug text-amber-800 shadow-sm transition hover:bg-amber-500/25 active:scale-[0.98] dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
        >
          ⚖️ חרגת ב-{coverage.overshootKcal} קק״ל • לאפשרויות האיזון השבועי בדשבורד
        </button>
      )}

      <WeeklyCalorieCard budget={calorieBudget} onChangeCreditSpread={setCreditSpreadDays} />


      <button
        type="button"
        data-tour="voice-meal"
        onClick={() => setIsVoiceOpen(true)}
        className="group flex w-full items-center gap-3 rounded-2xl border border-lime-400/40 bg-gradient-to-l from-lime-400/15 to-lime-400/5 p-4 text-right shadow-glow transition active:scale-[0.98]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime-400 text-zinc-950">
          <Mic className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold text-zinc-900 dark:text-zinc-100">הקלטה מהירה ב-AI 🎙️</span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400">ספרו מה אכלתם, ה-AI יחשב קלוריות ומאקרו</span>
        </span>
      </button>

      <div className="flex flex-col gap-4">
        {MEAL_ORDER.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={entriesForDate.filter((e) => e.meal === meal)}
            onAdd={() => setAddingMeal(meal)}
            onScan={() => setScanSourceMeal(meal)}
            onDelete={onDeleteFood}
            onEdit={setEditingEntry}
            favoriteFoods={favoriteFoods}
            onToggleFavorite={onToggleFavorite}
            yesterdayEntries={copyMealEntries(foodLog, shiftDate(selectedDate, -1), selectedDate, meal)}
            onCopyYesterday={(entries) => {
              entries.forEach(onAddFood);
              setToastMessage(`הועתקו ${entries.length} פריטים מאתמול`);
            }}
            onSaveMeal={(name, entries) => {
              onSaveMeal(name, entries);
              setToastMessage(`הארוחה "${name}" נשמרה`);
            }}
          />
        ))}
      </div>

      {editingEntry && (
        <EditMealModal
          entry={editingEntry}
          onSave={(id, updates) => {
            onUpdateFood(id, updates);
            setToastMessage('הפריט עודכן בהצלחה ✓');
          }}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {isVoiceOpen && (
        <VoiceMealModal
          meal={getMealForCurrentTime()}
          date={selectedDate}
          onConfirm={(entries) => {
            entries.forEach(onAddFood);
            setToastMessage(entries.length === 1 ? 'הארוחה נוספה ליומן' : `${entries.length} פריטים נוספו ליומן`);
          }}
          onClose={() => setIsVoiceOpen(false)}
        />
      )}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}

      {scanSourceMeal && (
        <PhotoSourceSheet
          onFile={(file) => setScanRequest({ meal: scanSourceMeal, file })}
          onClose={() => setScanSourceMeal(null)}
        />
      )}

      {addingMeal &&
        createPortal(
          <AddFoodModal
            meal={addingMeal}
            date={selectedDate}
            onAdd={onAddFood}
            favorites={favoriteFoods}
            recents={recentFoods}
            savedMeals={savedMeals}
            onRemoveFavorite={(food) => onToggleFavorite(food)}
            onDeleteSavedMeal={(meal) => onDeleteSavedMeal(meal.id)}
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
  covered,
}: {
  targetCalories: number;
  targetMacros: { proteinG: number; fatG: number; carbsG: number };
  eaten: { calories: number; proteinG: number; fatG: number; carbsG: number };
  remaining: { calories: number; proteinG: number; fatG: number; carbsG: number };
  /** Today's overshoot is already covered: shown calmly, not as a problem. */
  covered: boolean;
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
      <CalorieRing target={targetCalories} eaten={eaten.calories} remaining={remaining.calories} covered={covered} />
      <div className="flex w-full flex-1 flex-col gap-3">
        <MacroRemainingBar
          icon={Beef}
          label="חלבון"
          color="#a3e635"
          targetG={targetMacros.proteinG}
          remainingG={remaining.proteinG}
          calm={covered}
        />
        <MacroRemainingBar
          icon={Droplet}
          label="שומן"
          color="#fb923c"
          targetG={targetMacros.fatG}
          remainingG={remaining.fatG}
          calm={covered}
        />
        <MacroRemainingBar
          icon={Wheat}
          label="פחמימה"
          color="#a1a1aa"
          targetG={targetMacros.carbsG}
          remainingG={remaining.carbsG}
          calm={covered}
        />
      </div>
    </div>
  );
}

function CalorieRing({ target, eaten, remaining, covered }: { target: number; eaten: number; remaining: number; covered: boolean }) {
  if (covered) return <BalancedRing eaten={eaten} target={target} />;
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
          {formatMacro(Math.abs(remaining))}
        </span>
        <span className="text-[10px] leading-tight text-zinc-600 dark:text-zinc-500">{isOver ? 'חריגה קק״ל' : 'נשארו קק״ל'}</span>
        <span className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-600">
          {formatMacro(eaten)}/{formatMacro(target)}
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
  calm = false,
}: {
  icon: typeof Beef;
  label: string;
  color: string;
  targetG: number;
  remainingG: number;
  /** Today's overshoot is covered: a macro over its target is noted, not flagged in orange. */
  calm?: boolean;
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
        <span className={`truncate whitespace-nowrap font-semibold tabular-nums ${isOver && !calm ? 'text-orange-700 dark:text-orange-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
          {isOver ? `${calm ? 'מעל היעד' : 'חריגה'} ${formatMacro(Math.abs(remainingG))} גר׳` : `נותרו ${formatMacro(remainingG)} גר׳`}
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
  onEdit,
  favoriteFoods,
  onToggleFavorite,
  yesterdayEntries,
  onCopyYesterday,
  onSaveMeal,
}: {
  meal: Meal;
  entries: FoodEntry[];
  onAdd: () => void;
  onScan: () => void;
  onDelete: (id: string) => void;
  onEdit: (entry: FoodEntry) => void;
  favoriteFoods: FavoriteFood[];
  onToggleFavorite: (food: FoodEntry) => void;
  /** The same meal as eaten the day before, ready to copy (empty when there was none). */
  yesterdayEntries: Omit<FoodEntry, 'id'>[];
  onCopyYesterday: (entries: Omit<FoodEntry, 'id'>[]) => void;
  onSaveMeal: (name: string, entries: FoodEntry[]) => void;
}) {
  const [isNamingMeal, setIsNamingMeal] = useState(false);
  const [mealName, setMealName] = useState('');
  // Recomputed from the entries on every add / delete / edit.
  const mealTotals = useMemo(() => sumTotals(entries), [entries]);
  const mealCalories = mealTotals.calories;
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
            aria-label="סרוק ארוחה מתמונה"
            title="סרוק ארוחה מתמונה (מצלמה או גלריה)"
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-600">לא נרשמו פריטים</p>
          {yesterdayEntries.length > 0 && (
            <button
              type="button"
              onClick={() => onCopyYesterday(yesterdayEntries)}
              className="flex items-center gap-1 rounded-lg border border-lime-400/40 bg-lime-400/10 px-2.5 py-1.5 text-xs font-semibold text-lime-700 transition hover:bg-lime-400/20 dark:text-lime-400"
            >
              <Copy className="h-3.5 w-3.5" />
              העתק מאתמול ({yesterdayEntries.length})
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-lg bg-white/60 dark:bg-zinc-900/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{getEntryTitle(entry)}</p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-500">
                  {entry.quantity} &bull; {formatMacro(entry.calories)} קק״ל &bull; {formatMacro(entry.proteinG)}ח׳ {formatMacro(entry.fatG)}ש׳{' '}
                  {formatMacro(entry.carbsG)}פ׳
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(entry)}
                  aria-label={findFavorite(favoriteFoods, entry) ? `הסרת ${getEntryTitle(entry)} מהמועדפים` : `הוספת ${getEntryTitle(entry)} למועדפים`}
                  aria-pressed={!!findFavorite(favoriteFoods, entry)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-amber-500/10 ${
                    findFavorite(favoriteFoods, entry) ? 'text-amber-500' : 'text-zinc-600 dark:text-zinc-500 hover:text-amber-500'
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${findFavorite(favoriteFoods, entry) ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  aria-label={`עריכת ${getEntryTitle(entry)}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-500 transition hover:bg-lime-400/10 hover:text-lime-600 dark:hover:text-lime-400"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry.id)}
                  aria-label="מחיקה"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-zinc-200 dark:border-zinc-800 pt-2.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            סה״כ לארוחה: {formatMacro(mealTotals.calories)} קק״ל
          </span>
          <MacroTotal dotClass="bg-lime-400" label="חלבון" grams={mealTotals.proteinG} />
          <MacroTotal dotClass="bg-zinc-400 dark:bg-zinc-200" label="פחמימה" grams={mealTotals.carbsG} />
          <MacroTotal dotClass="bg-orange-400" label="שומן" grams={mealTotals.fatG} />
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-2.5">
          {isNamingMeal ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!mealName.trim()) return;
                onSaveMeal(mealName.trim(), entries);
                setMealName('');
                setIsNamingMeal(false);
              }}
            >
              <input
                autoFocus
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                maxLength={40}
                placeholder="שם לארוחה, למשל: ארוחת בוקר רגילה"
                aria-label="שם הארוחה השמורה"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
              />
              <button type="submit" disabled={!mealName.trim()} className="btn-primary px-3 py-2 text-xs disabled:opacity-40">
                שמירה
              </button>
              <button type="button" onClick={() => setIsNamingMeal(false)} className="btn-secondary px-3 py-2 text-xs">
                ביטול
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsNamingMeal(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600 transition hover:text-lime-700 dark:text-zinc-500 dark:hover:text-lime-400"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              שמור כארוחה קבועה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MacroTotal({ dotClass, label, grams }: { dotClass: string; label: string; grams: number }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">&bull;</span>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dotClass}`} />
      {formatMacro(grams)}ג׳ {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add food modal
// ---------------------------------------------------------------------------

function AddFoodModal({
  meal,
  date,
  onAdd,
  favorites,
  recents,
  savedMeals,
  onRemoveFavorite,
  onDeleteSavedMeal,
  onClose,
}: {
  meal: Meal;
  date: string;
  onAdd: (entry: Omit<FoodEntry, 'id'>) => void;
  favorites: FavoriteFood[];
  recents: FoodTemplate[];
  savedMeals: SavedMeal[];
  onRemoveFavorite: (food: FavoriteFood) => void;
  onDeleteSavedMeal: (meal: SavedMeal) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [fatG, setFatG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [pickedFood, setPickedFood] = useState<FoodPer100g | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isBarcodeIntroOpen, setIsBarcodeIntroOpen] = useState(false);
  // A scanned product opens with a ready amount; a searched one still starts empty.
  const [pickedFromScan, setPickedFromScan] = useState(false);

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
    // An empty field counts as 0; a lone "." is not a number.
    const cal = calories.trim() === '' ? 0 : parseDecimal(calories);
    if (!name.trim() || cal === null) return;
    onAdd({
      date,
      meal,
      name: name.trim(),
      quantity: quantity.trim() || '1 מנה',
      calories: cal,
      proteinG: parseDecimal(proteinG) ?? 0,
      fatG: parseDecimal(fatG) ?? 0,
      carbsG: parseDecimal(carbsG) ?? 0,
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

        {isBarcodeIntroOpen && (
          <BarcodeIntro
            onContinue={() => {
              markBarcodeIntroSeen();
              setIsBarcodeIntroOpen(false);
              setIsScanning(true);
            }}
            onCancel={() => setIsBarcodeIntroOpen(false)}
          />
        )}

        {isScanning && (
          <BarcodeScanner
            onFound={(food) => {
              setIsScanning(false);
              setPickedFromScan(true);
              setPickedFood(food);
            }}
            onClose={() => setIsScanning(false)}
          />
        )}

        {pickedFood && (
          <div className="p-4">
            <ServingPanel
              food={pickedFood}
              meal={meal}
              date={date}
              onBack={() => setPickedFood(null)}
              onAdd={onAdd}
              onDone={onClose}
              prefillAmount={pickedFromScan}
            />
          </div>
        )}

        {/* Kept mounted (just hidden) while a food is picked, so the search text and results survive "back to search". */}
        <div className={`flex-col gap-4 p-4 ${pickedFood ? 'hidden' : 'flex'}`}>
          <QuickFoodShortcuts
            favorites={favorites}
            recents={recents}
            savedMeals={savedMeals}
            onAddFood={(food) => {
              onAdd(templateToEntry(food, date, meal));
              onClose();
            }}
            onAddMeal={(saved) => {
              saved.items.forEach((item) => onAdd(templateToEntry(item, date, meal)));
              onClose();
            }}
            onRemoveFavorite={onRemoveFavorite}
            onDeleteSavedMeal={onDeleteSavedMeal}
          />

          <button
            type="button"
            onClick={() => (hasSeenBarcodeIntro() ? setIsScanning(true) : setIsBarcodeIntroOpen(true))}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime-400/40 bg-lime-400/10 py-3 text-sm font-bold text-lime-700 transition hover:bg-lime-400/20 dark:text-lime-400"
          >
            <ScanBarcode className="h-4 w-4" />
            סרוק ברקוד של מוצר
          </button>

          <FoodSearch
            onPick={(food) => {
              setPickedFromScan(false);
              setPickedFood(food);
            }}
          />

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
                <DecimalInput
                  value={calories}
                  onValueChange={setCalories}
                  placeholder="קק״ל"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                />
                <DecimalInput
                  value={proteinG}
                  onValueChange={setProteinG}
                  placeholder="חלבון"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                />
                <DecimalInput
                  value={fatG}
                  onValueChange={setFatG}
                  placeholder="שומן"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                />
                <DecimalInput
                  value={carbsG}
                  onValueChange={setCarbsG}
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
