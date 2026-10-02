import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Calendar as CalendarIcon,
  Camera,
  Check,
  ChevronLeft,
  Database,
  Download,
  Dumbbell,
  FileSpreadsheet,
  Flame,
  Footprints,
  HelpCircle,
  LayoutDashboard,
  List,
  LogOut,
  Moon,
  Pencil,
  Play,
  Rocket,
  Ruler,
  RotateCcw,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  User as UserIcon,
  UtensilsCrossed,
  Weight,
} from 'lucide-react';
import VideoModal from './VideoModal';
import ExerciseSwapModal from './ExerciseSwapModal';
import RestTimer from './RestTimer';
import WeightTracker from './WeightTracker';
import ProgressPhotos from './ProgressPhotos';
import TransparencyModal from './TransparencyModal';
import WorkoutCalendar from './WorkoutCalendar';
import Academy from './Academy';
import FoodTracker from './FoodTracker';
import Settings from './Settings';
import { ThemeToggleButton } from './ThemeToggle';
import StepsTracker from './StepsTracker';
import { DEFAULT_STEP_GOAL } from '../utils/stepsCalculations';
import { formatMacro } from '../utils/formatMacro';
import RestTimerWidget from './RestTimerWidget';
import RestFinishedAlert from './RestFinishedAlert';
import RestTimerMiniBar from './RestTimerMiniBar';
import GuidedTour, { type TourStep } from './GuidedTour';
import HelpCenterModal from './HelpCenterModal';
import { hasSeenTour, markTourSeen } from '../utils/tourState';
import { DEMO_USER_ID } from '../utils/demoData';
import { useRestTimer } from '../context/restTimerContext';
import HeroCarousel, { type HeroSlide } from './HeroCarousel';
import DailyMealsModal from './DailyMealsModal';
import CircumferenceTracker from './CircumferenceTracker';
import ResetConfirmModal from './ResetConfirmModal';
import ImportConfirmModal from './ImportConfirmModal';
import EditProfileModal from './EditProfileModal';
import Toast from './Toast';
import { BODY_TYPE_OPTIONS } from '../data/bodyTypes';
import { MUSCLE_GROUP_LABELS } from '../data/muscleLabels';
import { buildWeeklySummaries, daysSince, getWeekStart, todayIso } from '../utils/weightCalculations';
import { countCompletedWorkoutsThisWeek } from '../utils/workoutStats';
import { useToday } from '../hooks/useToday';
import { getWeeklyCoachInsight } from '../utils/coachInsights';
import { buildWeekGrid, getTodaysPlanDay, isDayCompleted, REST_DAY_ID, SPLIT_SHORT_LABELS, type CalendarDay } from '../utils/scheduleHelpers';
import ProgramSwitcherModal from './ProgramSwitcherModal';
import QuickDayEditSheet from './QuickDayEditSheet';
import { sumTotals, type DailyTotals } from '../utils/nutritionLog';
import type { BulkWeightEntry } from '../utils/bulkWeightParser';
import { buildAppStateCsv } from '../utils/csvExport';
import { parseBackupFile, type RestoreSummary } from '../utils/backupValidation';
import RestoreResultModal, { type RestoreResult } from './RestoreResultModal';
import type {
  AppState,
  DayWorkout,
  Exercise,
  ExerciseAlternative,
  FoodEntry,
  ProgressPhoto,
  SetProgressEntry,
  TrainingDaysPerWeek,
  WorkoutSplitType,
  WeightLog,
  WorkoutScheduleEntry,
} from '../types/fitness';
import type {
  BodyMeasurements,
  CircumferenceGoals,
  Goal,
  GoalIntensity,
  NutritionPlan,
  UserMetrics,
  WorkoutPlan,
} from '../types/fitness';

interface DashboardProps {
  appState: AppState;
  onToggleSet: (dayId: string, exerciseId: string, setIndex: number) => void;
  onSwapExercise: (dayId: string, exerciseId: string, alternative: ExerciseAlternative) => void;
  onRevertExercise: (dayId: string, exerciseId: string) => void;
  onSaveWeightLog: (date: string, weightKg: number, notes?: string) => void;
  onBulkImportWeightLogs: (entries: BulkWeightEntry[]) => void;
  onDeleteWeightLog: (id: string) => void;
  onAddPhoto: (photo: Omit<ProgressPhoto, 'id'>) => Promise<void>;
  onDeletePhoto: (id: string) => void;
  onUpdatePhoto: (id: string, patch: Partial<Pick<ProgressPhoto, 'date' | 'weightKg'>>) => void;
  onApplyCalorieAdjustment: (deltaKcal: number) => void;
  onQuickCompleteDay: (dayId: string, date?: string) => void;
  onUndoCompleteDay: (dayId: string, date?: string) => void;
  onSetSchedule: (date: string, dayId: string, customLabel?: string) => void;
  onClearSchedule: (date: string) => void;
  onAddFood: (entry: Omit<FoodEntry, 'id'>) => void;
  onDeleteFood: (id: string) => void;
  onUpdateFood: (id: string, updates: Partial<Omit<FoodEntry, 'id' | 'date' | 'meal'>>) => void;
  onSaveSteps: (date: string, steps: number) => void;
  onSaveStepGoal: (goal: number) => void;
  onSaveCircumferenceEntry: (date: string, measurements: BodyMeasurements) => void;
  onDeleteCircumferenceEntry: (id: string) => void;
  onSaveCircumferenceGoals: (goals: CircumferenceGoals) => void;
  onApplyProgram: (split: WorkoutSplitType, days: TrainingDaysPerWeek) => void;
  onUpdateProfileFull: (updates: Partial<UserMetrics>) => void;
  onImportAppState: (data: AppState) => Promise<void>;
  onReset: () => void;
  onLogout: () => void;
}

// ---------------------------------------------------------------------------
// Dashboard shell (nav + tabs)
// ---------------------------------------------------------------------------

// 'calendar' has no top-level tab anymore - it's nested inside the workout tab as a
// small sub-tab. 'academy' stays a valid render target (reachable from the profile
// shortcut card and the hero carousel's third slide) but isn't in the 5-item nav below.
type Tab = 'dashboard' | 'workout' | 'nutrition' | 'progress' | 'academy' | 'profile';

const NAV_ITEMS: { id: Tab; label: string; shortLabel: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'דשבורד', shortLabel: 'דשבורד', icon: LayoutDashboard },
  { id: 'workout', label: 'אימון', shortLabel: 'אימון', icon: Dumbbell },
  { id: 'nutrition', label: 'תזונה', shortLabel: 'תזונה', icon: UtensilsCrossed },
  { id: 'progress', label: 'התקדמות', shortLabel: 'התקדמות', icon: TrendingUp },
  { id: 'profile', label: 'פרופיל', shortLabel: 'פרופיל', icon: UserIcon },
];

/** Stable empty list so memo dependencies don't change on every render when no dates are stored. */
const NO_DATES: string[] = [];

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    tab: 'dashboard',
    title: 'ברוכים הבאים ל-MacroLift! 👋',
    body: 'סיור קצר שיראה לכם את הכלים המרכזיים: שקילה, תזונה בהקלטה קולית, אימון וטיימר מנוחה, תמונות התקדמות וגיבוי הנתונים. אפשר לדלג בכל שלב, ולחזור לסיור דרך מסך הפרופיל.',
  },
  {
    id: 'weight',
    tab: 'progress',
    target: 'weight-entry',
    title: 'שקילת בוקר וגרף מגמה',
    body: 'מזינים כאן את המשקל כל בוקר. ככל שמצטברות שקילות מופיע גרף מגמה, ואפשר לסנן אותו לפי שבוע אחרון, חודש, 3 חודשים או כל הזמן, ולבחור בין קו חלק, נקודות או שטח מוצלל.',
  },
  {
    id: 'voice',
    tab: 'nutrition',
    target: 'voice-meal',
    title: 'הקלטה מהירה ב-AI 🎙️',
    body: 'לוחצים ומספרים בדיבור חופשי מה אכלתם, למשל "אכלתי 200 גרם חזה עוף וכוס אורז". ה-AI מזהה את המאכלים, מעריך גרמים וערכים תזונתיים, ואתם בודקים, מתקנים ומוסיפים ליומן.',
  },
  {
    id: 'workout',
    tab: 'workout',
    target: 'rest-timer',
    title: 'אימון וטיימר המנוחה הגלובלי',
    body: 'מסמנים סט שהושלם בתוכנית האימון וטיימר מנוחה מתחיל אוטומטית, או שמפעילים אותו ידנית כאן. הטיימר ממשיך לרוץ גם כשעוברים למסכים אחרים (סרגל קטן מעל התפריט מראה את הזמן), ובסיום תשמעו צפצופים ותראו הבהוב ירוק.',
  },
  {
    id: 'photos',
    tab: 'progress',
    target: 'progress-photos',
    title: 'תמונות התקדמות ומאמן ה-AI',
    body: 'מעלים תמונה עם תאריך. כשיש שתיים לפחות אפשר להשוות לפני / אחרי, ללחוץ על "ניתוח התקדמות עם AI", ולהמשיך בדיון עם המאמן על הממצאים ועל הצעדים הבאים.',
  },
  {
    id: 'backup',
    tab: 'profile',
    target: 'backup',
    title: 'גיבוי נתונים (JSON)',
    body: 'המידע שלכם נשמר רק במכשיר הזה. "גיבוי נתונים" יוצר קובץ JSON שאפשר להעביר למכשיר אחר ולשחזר שם, ובכך גם מגנים על המידע אם משנים טלפון או מנקים את הדפדפן.',
  },
];

export default function Dashboard({
  appState,
  onToggleSet,
  onSwapExercise,
  onRevertExercise,
  onSaveWeightLog,
  onBulkImportWeightLogs,
  onDeleteWeightLog,
  onAddPhoto,
  onDeletePhoto,
  onUpdatePhoto,
  onApplyCalorieAdjustment,
  onQuickCompleteDay,
  onUndoCompleteDay,
  onSetSchedule,
  onClearSchedule,
  onAddFood,
  onDeleteFood,
  onUpdateFood,
  onSaveSteps,
  onSaveStepGoal,
  onSaveCircumferenceEntry,
  onDeleteCircumferenceEntry,
  onSaveCircumferenceGoals,
  onApplyProgram,
  onUpdateProfileFull,
  onImportAppState,
  onReset,
  onLogout,
}: DashboardProps) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const restTimerStatus = useRestTimer().status;
  const [isTourOpen, setIsTourOpen] = useState(false);
  const profileId = appState.profile.id;

  // First launch for a new profile: start the tour once (the demo account is a showcase, so it skips it).
  useEffect(() => {
    if (profileId === DEMO_USER_ID || hasSeenTour()) return;
    const id = setTimeout(() => {
      markTourSeen();
      setIsTourOpen(true);
    }, 900);
    return () => clearTimeout(id);
  }, [profileId]);

  return (
    <div className="flex min-h-svh bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Ambient background glows - fixed to the viewport so they read as soft, persistent lighting */}
      <div className="pointer-events-none fixed -top-24 -right-24 -z-10 h-[420px] w-[420px] rounded-full bg-lime-500/5 blur-[120px] dark:bg-lime-500/10" />
      <div className="pointer-events-none fixed -bottom-24 -left-24 -z-10 h-[420px] w-[420px] rounded-full bg-emerald-500/5 blur-[120px] dark:bg-emerald-500/10" />

      <RestFinishedAlert />

      {isTourOpen && <GuidedTour steps={TOUR_STEPS} onNavigate={(t) => setTab(t as Tab)} onClose={() => setIsTourOpen(false)} />}

      {/* App-wide rest timer: the full card on the workout screen, a compact bar above the nav everywhere else */}
      {restTimerStatus !== 'idle' &&
        (tab === 'workout' ? <RestTimer /> : <RestTimerMiniBar onOpenWorkout={() => setTab('workout')} />)}

      {/* Opaque strip behind the iPhone status bar / camera cutout so scrolled content never shows through it */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md md:hidden" />

      {/* Theme toggle - mobile top bar (no persistent header exists on mobile otherwise) */}
      <div className="fixed left-4 top-[max(env(safe-area-inset-top),1rem)] z-30 md:hidden">
        <ThemeToggleButton />
      </div>

      {/* Sidebar - desktop / tablet */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 p-6 md:flex">
        <div className="mb-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-400 text-zinc-950">
              <Dumbbell className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-extrabold tracking-tight">MacroLift</span>
          </div>
          <ThemeToggleButton />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-right font-medium transition ${
                tab === id
                  ? 'bg-lime-400/10 text-lime-700 dark:text-lime-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-500 transition hover:bg-white dark:hover:bg-zinc-900 hover:text-red-400"
          >
            <RotateCcw className="h-5 w-5" />
            התחלה מחדש
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-500 transition hover:bg-white dark:hover:bg-zinc-900 hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
            התנתקות
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[max(calc(env(safe-area-inset-top)+1rem),3rem)] sm:px-6 md:pb-10 md:pt-6 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-5xl">
          {tab === 'dashboard' && (
            <DashboardTab
              appState={appState}
              onApplyProgram={onApplyProgram}
              onQuickCompleteDay={onQuickCompleteDay}
              onUndoCompleteDay={onUndoCompleteDay}
              onSetSchedule={onSetSchedule}
              onSaveWeightLog={onSaveWeightLog}
              onSaveSteps={onSaveSteps}
              onSaveStepGoal={onSaveStepGoal}
              onDeleteFood={onDeleteFood}
              onUpdateFood={onUpdateFood}
              onNavigate={setTab}
            />
          )}
          {tab === 'workout' && (
            <WorkoutPlanTab
              workoutPlan={appState.workoutPlan}
              schedule={appState.schedule}
              progress={appState.progress}
              completedDates={appState.completedWorkoutDates ?? NO_DATES}
              onToggleSet={onToggleSet}
              onSwapExercise={onSwapExercise}
              onRevertExercise={onRevertExercise}
              onQuickCompleteDay={onQuickCompleteDay}
              onUndoCompleteDay={onUndoCompleteDay}
              onSetSchedule={onSetSchedule}
              onClearSchedule={onClearSchedule}
            />
          )}
          {tab === 'nutrition' && (
            <FoodTracker
              foodLog={appState.foodLog}
              nutritionPlan={appState.nutritionPlan}
              onAddFood={onAddFood}
              onDeleteFood={onDeleteFood}
            />
          )}
          {tab === 'progress' && (
            <ProgressTab
              weightLogs={appState.weightLogs}
              progressPhotos={appState.progressPhotos}
              goal={appState.profile.metrics.goal}
              goalIntensity={appState.profile.metrics.goalIntensity}
              onSaveWeightLog={onSaveWeightLog}
              onBulkImportWeightLogs={onBulkImportWeightLogs}
              onDeleteWeightLog={onDeleteWeightLog}
              onAddPhoto={onAddPhoto}
              onDeletePhoto={onDeletePhoto}
              onUpdatePhoto={onUpdatePhoto}
              appState={appState}
              onApplyCalorieAdjustment={onApplyCalorieAdjustment}
            />
          )}
          {tab === 'academy' && <Academy />}
          {tab === 'profile' && (
            <ProfileTab
              appState={appState}
              onApplyProgram={onApplyProgram}
              onUpdateProfileFull={onUpdateProfileFull}
              onSaveCircumferenceEntry={onSaveCircumferenceEntry}
              onDeleteCircumferenceEntry={onDeleteCircumferenceEntry}
              onSaveCircumferenceGoals={onSaveCircumferenceGoals}
              onImportAppState={onImportAppState}
              onBulkImportWeightLogs={onBulkImportWeightLogs}
              onNavigate={setTab}
              onRequestReset={() => setIsResetConfirmOpen(true)}
              onLogout={onLogout}
              onStartTour={() => setIsTourOpen(true)}
            />
          )}
        </div>
      </main>

      {/* Bottom nav - mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {NAV_ITEMS.map(({ id, shortLabel, icon: Icon }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition ${
                isActive ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-500'
              }`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${isActive ? 'bg-lime-400/10' : ''}`}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.5 : 2} />
              </span>
              {shortLabel}
            </button>
          );
        })}
      </nav>

      {isResetConfirmOpen && (
        <ResetConfirmModal onConfirm={onReset} onClose={() => setIsResetConfirmOpen(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard tab
// ---------------------------------------------------------------------------

function DashboardTab({
  appState,
  onApplyProgram,
  onQuickCompleteDay,
  onUndoCompleteDay,
  onSetSchedule,
  onSaveWeightLog,
  onSaveSteps,
  onSaveStepGoal,
  onDeleteFood,
  onUpdateFood,
  onNavigate,
}: {
  appState: AppState;
  onApplyProgram: (split: WorkoutSplitType, days: TrainingDaysPerWeek) => void;
  onQuickCompleteDay: (dayId: string, date?: string) => void;
  onUndoCompleteDay: (dayId: string, date?: string) => void;
  onSetSchedule: (date: string, dayId: string, customLabel?: string) => void;
  onSaveWeightLog: (date: string, weightKg: number, notes?: string) => void;
  onSaveSteps: (date: string, steps: number) => void;
  onSaveStepGoal: (goal: number) => void;
  onDeleteFood: (id: string) => void;
  onUpdateFood: (id: string, updates: Partial<Omit<FoodEntry, 'id' | 'date' | 'meal'>>) => void;
  onNavigate: (tab: Tab) => void;
}) {
  const [isDailyMealsOpen, setIsDailyMealsOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const { profile, nutritionPlan, workoutPlan, weightLogs, progressPhotos, schedule, progress, stepLogs, foodLog } = appState;
  const completedDates = appState.completedWorkoutDates ?? NO_DATES;
  const todaysFoodEntries = useMemo(() => foodLog.filter((f) => f.date === todayIso()), [foodLog]);
  const eatenToday = useMemo(() => sumTotals(todaysFoodEntries), [todaysFoodEntries]);
  const todaysDay = useMemo(() => getTodaysPlanDay(workoutPlan, schedule), [workoutPlan, schedule]);
  const todaysDayCompleted = useMemo(
    () => completedDates.includes(todayIso()) || isDayCompleted(workoutPlan, progress, todayIso(), todaysDay.id),
    [workoutPlan, progress, todaysDay, completedDates],
  );

  const latestPhotoDaysAgo = useMemo(() => {
    if (progressPhotos.length === 0) return null;
    const latest = [...progressPhotos].sort((a, b) => (a.date > b.date ? -1 : 1))[0];
    return daysSince(latest.date);
  }, [progressPhotos]);

  const showPhotoReminder = latestPhotoDaysAgo === null || latestPhotoDaysAgo >= 30;

  // Dashboard hero carousel is workout/gym imagery only (nutrition & recovery photos
  // live on their own screens) - every slide leads to the same "start workout" action.
  const heroSlides: HeroSlide[] = useMemo(() => {
    const targetMuscles = Array.from(new Set(todaysDay.exercises.map((e) => e.muscleGroup))).map(
      (m) => MUSCLE_GROUP_LABELS[m],
    );

    return [
      {
        id: 'today',
        imageUrl: HERO_WORKOUT_IMAGE,
        eyebrow: todaysDay.dayLabel,
        headline: 'אימון היום מחכה לך',
        body: todaysDay.focus,
        tags: targetMuscles,
        ctaLabel: 'התחל אימון',
        onCta: () => onNavigate('workout'),
      },
      {
        id: 'records',
        imageUrl: HERO_RECORDS_IMAGE,
        eyebrow: 'קדימה',
        headline: 'שוברים שיאים',
        body: 'כל סט הוא הזדמנות להוסיף עוד חזרה, עוד קילו, עוד התקדמות. הבא בתור זה אתם.',
        ctaLabel: 'התחל אימון',
        onCta: () => onNavigate('workout'),
      },
      {
        id: 'consistency',
        imageUrl: HERO_CONSISTENCY_IMAGE,
        eyebrow: 'משמעת',
        headline: 'התמדה מביאה תוצאות',
        body: 'לא האימון המושלם בונה את הגוף - האימון שחוזר על עצמו שוב ושוב.',
        ctaLabel: 'התחל אימון',
        onCta: () => onNavigate('workout'),
      },
      {
        id: 'limit',
        imageUrl: HERO_LIMIT_IMAGE,
        eyebrow: 'כוח',
        headline: 'הגבול הוא רק בראש',
        body: 'כל חזרה נוספת מקרבת אתכם למי שאתם רוצים להיות.',
        ctaLabel: 'התחל אימון',
        onCta: () => onNavigate('workout'),
      },
      {
        id: 'effort',
        imageUrl: HERO_EFFORT_IMAGE,
        eyebrow: 'מחויבות',
        headline: 'תנו הכל, בכל סט',
        body: 'האנרגיה שאתם משקיעים היום היא התוצאה של מחר.',
        ctaLabel: 'התחל אימון',
        onCta: () => onNavigate('workout'),
      },
    ];
  }, [todaysDay, onNavigate]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">שלום, {profile.name} 👋</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">הנה סיכום היעדים והאימון שלך להיום</p>
      </div>

      <HeroCarousel slides={heroSlides} />

      <QuickCompleteButton
        day={todaysDay}
        isCompleted={todaysDayCompleted}
        onQuickCompleteDay={onQuickCompleteDay}
        onUndoCompleteDay={onUndoCompleteDay}
      />

      <CoachInsightCard
        goal={profile.metrics.goal}
        weightLogs={weightLogs}
        workoutPlan={workoutPlan}
        progress={progress}
      />

      {showPhotoReminder && progressPhotos.length > 0 && (
        <div className="glass-card flex items-center gap-3 border-orange-400/20 bg-orange-400/5 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-orange-700 dark:text-orange-400" />
          <p className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
            עברו {latestPhotoDaysAgo} ימים מאז תמונת ההתקדמות האחרונה. זה הזמן לצלם עדכון בטאב "התקדמות".
          </p>
        </div>
      )}

      <ProgramCard
        splitType={workoutPlan.splitType}
        daysPerWeek={profile.metrics.trainingDaysPerWeek}
        onChangeProgram={() => setIsProgramModalOpen(true)}
      />

      <WeeklyCalendarWidget
        workoutPlan={workoutPlan}
        progress={progress}
        schedule={schedule}
        completedDates={completedDates}
        onSelectDay={setEditingDay}
        onNavigate={() => onNavigate('workout')}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <WeightTracker logs={weightLogs} onSave={onSaveWeightLog} compact />
        <NutritionCard
          metrics={profile.metrics}
          nutritionPlan={nutritionPlan}
          eaten={eatenToday}
          onOpenDailyMeals={() => setIsDailyMealsOpen(true)}
        />
        <StreaksCard
          weightLogs={weightLogs}
          workoutPlan={workoutPlan}
          progress={progress}
          completedDates={completedDates}
          trainingDaysPerWeek={profile.metrics.trainingDaysPerWeek}
        />
      </div>

      <StepsTracker
        stepLogs={stepLogs}
        goalSteps={appState.stepGoal ?? DEFAULT_STEP_GOAL}
        weightKg={profile.metrics.weightKg}
        onSaveSteps={onSaveSteps}
        onSaveGoal={onSaveStepGoal}
      />

      {isDailyMealsOpen && (
        <DailyMealsModal
          entries={todaysFoodEntries}
          onUpdate={onUpdateFood}
          onDelete={onDeleteFood}
          onClose={() => setIsDailyMealsOpen(false)}
        />
      )}

      {editingDay && (
        <QuickDayEditSheet
          date={editingDay}
          workoutPlan={workoutPlan}
          progress={progress}
          schedule={schedule}
          completedDates={completedDates}
          onQuickCompleteDay={onQuickCompleteDay}
          onUndoCompleteDay={onUndoCompleteDay}
          onSetSchedule={onSetSchedule}
          onOpenFull={() => onNavigate('workout')}
          onClose={() => setEditingDay(null)}
        />
      )}

      {isProgramModalOpen && (
        <ProgramSwitcherModal
          currentSplit={workoutPlan.splitType}
          currentDays={profile.metrics.trainingDaysPerWeek}
          onApply={onApplyProgram}
          onClose={() => setIsProgramModalOpen(false)}
        />
      )}
    </div>
  );
}

/** Compact "current program" line on the home screen with a shortcut to switch it. */
function ProgramCard({
  splitType,
  daysPerWeek,
  onChangeProgram,
}: {
  splitType: WorkoutSplitType;
  daysPerWeek: number;
  onChangeProgram: () => void;
}) {
  return (
    <div className="glass-card flex items-center justify-between gap-3 p-3.5 sm:p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
          <Dumbbell className="h-5 w-5" />
        </span>
        <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
          תוכנית: <span className="text-lime-700 dark:text-lime-400">{SPLIT_SHORT_LABELS[splitType]}</span> • {daysPerWeek} ימים בשבוע
        </p>
      </div>
      <button
        type="button"
        onClick={onChangeProgram}
        className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
      >
        שנה תוכנית ⚙️
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero banner
// ---------------------------------------------------------------------------

// Hero carousel background photos - gym/weightlifting only (verified stable Unsplash CDN URLs).
const HERO_WORKOUT_IMAGE = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=80';
const HERO_RECORDS_IMAGE = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80';
const HERO_CONSISTENCY_IMAGE = 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1600&q=80';
const HERO_LIMIT_IMAGE = 'https://images.unsplash.com/photo-1533560904424-a0c61dc306fc?auto=format&fit=crop&w=1600&q=80';
const HERO_EFFORT_IMAGE = 'https://images.unsplash.com/photo-1585152968992-d2b9444408cc?auto=format&fit=crop&w=1600&q=80';

// Static single-slide hero banners for the other tabs (see WorkoutPlanTab / ProgressTab / ProfileTab below).
const TAB_HERO_WORKOUT_IMAGE = 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1600&q=80';
const TAB_HERO_PROGRESS_IMAGE = 'https://images.unsplash.com/photo-1576243345690-4e4b79b63288?auto=format&fit=crop&w=1600&q=80';
const TAB_HERO_PROFILE_IMAGE = 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=1600&q=80';

// ---------------------------------------------------------------------------
// Quick-complete "סיימתי אימון היום!" button
// ---------------------------------------------------------------------------

function QuickCompleteButton({
  day,
  isCompleted,
  onQuickCompleteDay,
  onUndoCompleteDay,
}: {
  day: DayWorkout;
  isCompleted: boolean;
  onQuickCompleteDay: (dayId: string, date?: string) => void;
  onUndoCompleteDay: (dayId: string, date?: string) => void;
}) {
  if (isCompleted) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-lime-400/40 bg-lime-400/10 px-4 py-3.5 text-sm font-bold text-lime-700 dark:text-lime-400">
          <Check className="h-4 w-4" />
          אימון היום הושלם! כל הכבוד 🎉
        </div>
        <button
          type="button"
          onClick={() => onUndoCompleteDay(day.id)}
          aria-label="ביטול סימון הושלם"
          title="ביטול סימון הושלם"
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition hover:border-orange-400/40 hover:text-orange-700 dark:hover:text-orange-400 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => onQuickCompleteDay(day.id)} className="btn-primary justify-center py-3.5 text-sm">
      💪 סיימתי אימון היום!
    </button>
  );
}

// ---------------------------------------------------------------------------
// Weekly calendar widget (compact)
// ---------------------------------------------------------------------------

function WeeklyCalendarWidget({
  workoutPlan,
  progress,
  schedule,
  completedDates,
  onSelectDay,
  onNavigate,
}: {
  workoutPlan: WorkoutPlan;
  progress: SetProgressEntry[];
  schedule: WorkoutScheduleEntry[];
  completedDates: readonly string[];
  onSelectDay: (date: string) => void;
  onNavigate: () => void;
}) {
  const today = useToday();
  const days = useMemo(
    () => buildWeekGrid(today, workoutPlan, progress, schedule, completedDates),
    [today, workoutPlan, progress, schedule, completedDates],
  );
  const weekdayLetters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">לוח השבוע</h2>
        </div>
        <button type="button" onClick={onNavigate} className="text-xs text-zinc-600 transition hover:text-lime-700 dark:text-zinc-500 dark:hover:text-lime-400">
          לצפייה בלוח המלא ←
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day: CalendarDay, i) => (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDay(day.date)}
            aria-label={`עריכת היום ${day.dayOfMonth}`}
            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition active:scale-95 sm:p-2 ${
              day.isToday
                ? 'border-lime-400/50 bg-lime-400/5 hover:bg-lime-400/10'
                : 'border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 hover:border-lime-400/40'
            }`}
          >
            <span className="text-[10px] text-zinc-600 dark:text-zinc-500">{weekdayLetters[i]}</span>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{day.dayOfMonth}</span>
            {day.isCompleted ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-lime-400 text-zinc-950">
                <Dumbbell className="h-2.5 w-2.5" />
              </span>
            ) : day.scheduled?.dayId === REST_DAY_ID ? (
              <span className="flex h-4 w-4 items-center justify-center text-zinc-500">
                <Moon className="h-3 w-3" />
              </span>
            ) : day.scheduled ? (
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400/70" />
            ) : (
              <span className="h-4 w-4" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart coach insight card
// ---------------------------------------------------------------------------

function CoachInsightCard({
  goal,
  weightLogs,
  workoutPlan,
  progress,
}: {
  goal: UserMetrics['goal'];
  weightLogs: WeightLog[];
  workoutPlan: WorkoutPlan;
  progress: SetProgressEntry[];
}) {
  const insight = useMemo(
    () => getWeeklyCoachInsight({ goal, weightLogs, workoutPlan, progress }),
    [goal, weightLogs, workoutPlan, progress],
  );

  return (
    <div className="glass-card flex items-start gap-3 border-lime-400/20 bg-lime-400/5 p-4 sm:p-5">
      <span className="text-2xl leading-none">{insight.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 flex items-center gap-1.5 text-xs font-bold text-lime-700 dark:text-lime-400">
          <Sparkles className="h-3.5 w-3.5" />
          תובנת השבוע מהמאמן
        </p>
        <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{insight.message}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consistency / streaks card
// ---------------------------------------------------------------------------

function StreaksCard({
  weightLogs,
  workoutPlan,
  progress,
  completedDates,
  trainingDaysPerWeek,
}: {
  weightLogs: WeightLog[];
  workoutPlan: WorkoutPlan;
  progress: SetProgressEntry[];
  completedDates: readonly string[];
  trainingDaysPerWeek: number;
}) {
  const today = useToday();

  const weighInsThisWeek = useMemo(() => {
    const weekStart = getWeekStart(today);
    return buildWeeklySummaries(weightLogs).find((s) => s.weekStart === weekStart)?.daysLogged ?? 0;
  }, [weightLogs, today]);

  const workoutsThisWeek = useMemo(
    () => countCompletedWorkoutsThisWeek(workoutPlan, progress, today, completedDates),
    [workoutPlan, progress, today, completedDates],
  );

  const progressRatio = Math.min(
    (weighInsThisWeek / 7 + workoutsThisWeek / Math.max(trainingDaysPerWeek, 1)) / 2,
    1,
  );
  const message =
    progressRatio >= 0.8 ? '🏆 שבוע מנצח, כל הכבוד!' : progressRatio >= 0.4 ? '🔥 ממשיכים חזק, קדימה!' : '💪 בואו נניע את השבוע!';

  return (
    <div className="glass-card flex flex-col gap-4 p-5 transition hover:border-lime-400/30 hover:shadow-glow sm:p-6">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange-700 dark:text-orange-400" />
        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">עקביות השבוע</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3 text-center">
          <p className="text-xl">🔥</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">{weighInsThisWeek}</p>
          <p className="text-[11px] leading-snug text-zinc-600 dark:text-zinc-500">ימי שקילה השבוע</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3 text-center">
          <p className="text-xl">💪</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {workoutsThisWeek}/{trainingDaysPerWeek}
          </p>
          <p className="text-[11px] leading-snug text-zinc-600 dark:text-zinc-500">אימונים הושלמו השבוע</p>
        </div>
      </div>

      <p className="rounded-xl border border-lime-400/20 bg-lime-400/5 px-3 py-2 text-center text-sm font-semibold text-lime-700 dark:text-lime-300">
        {message}
      </p>
    </div>
  );
}

function NutritionCard({
  metrics,
  nutritionPlan,
  eaten,
  onOpenDailyMeals,
}: {
  metrics: UserMetrics;
  nutritionPlan: NutritionPlan;
  eaten: DailyTotals;
  onOpenDailyMeals: () => void;
}) {
  const { targetCalories, macros } = nutritionPlan;
  const remainingCalories = targetCalories - eaten.calories;
  const isOver = remainingCalories < 0;
  const progressPercent = targetCalories > 0 ? Math.min((eaten.calories / targetCalories) * 100, 100) : 0;

  return (
    <div className="glass-card flex flex-col p-5 transition hover:border-lime-400/30 hover:shadow-glow sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange-700 dark:text-orange-400" />
        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">{isOver ? 'חריגה מהיעד' : 'נשארו להיום'}</h2>
      </div>

      <p
        className={`text-5xl font-extrabold tracking-tight ${isOver ? 'text-orange-700 dark:text-orange-400' : 'text-lime-700 dark:text-lime-400'}`}
      >
        {formatMacro(Math.abs(remainingCalories))}
      </p>
      <p className="text-xs text-zinc-600 dark:text-zinc-500">
        {isOver ? 'קק״ל מעל היעד' : 'קק״ל שנותרו'} · נצרכו {formatMacro(eaten.calories)} מתוך {formatMacro(targetCalories)} קק״ל
      </p>
      <div className="mb-3 mt-1.5">
        <TransparencyModal metrics={metrics} nutritionPlan={nutritionPlan} variant="link" />
      </div>

      <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${isOver ? 100 : progressPercent}%`, backgroundColor: isOver ? '#fb923c' : '#a3e635' }}
        />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <MacroStat color="#a3e635" label="חלבון" eatenG={eaten.proteinG} targetG={macros.proteinG} />
        <MacroStat color="#fb923c" label="שומן" eatenG={eaten.fatG} targetG={macros.fatG} />
        <MacroStat color="#a1a1aa" label="פחמימה" eatenG={eaten.carbsG} targetG={macros.carbsG} />
      </div>

      <button
        type="button"
        onClick={onOpenDailyMeals}
        className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
      >
        <List className="h-3.5 w-3.5" />
        פירוט ארוחות היום 📝
      </button>
    </div>
  );
}

function MacroStat({
  color,
  label,
  eatenG,
  targetG,
}: {
  color: string;
  label: string;
  eatenG: number;
  targetG: number;
}) {
  const progressPercent = targetG > 0 ? Math.min((eatenG / targetG) * 100, 100) : 0;
  const isOver = formatMacro(eatenG) > formatMacro(targetG);

  return (
    <div className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-2 min-[360px]:p-2.5">
      <div className="mb-1 flex min-w-0 items-center justify-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate text-[11px] text-zinc-600 dark:text-zinc-500">{label}</span>
      </div>
      <div className="mb-1.5">
        <p className="truncate whitespace-nowrap text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 min-[360px]:text-sm">
          {formatMacro(eatenG)}
          <span className="mx-0.5 font-normal text-zinc-500 dark:text-zinc-500">/</span>
          {formatMacro(targetG)}
        </p>
        <span className="block text-[10px] font-normal leading-none text-zinc-600 dark:text-zinc-500">גר׳</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${isOver ? 100 : progressPercent}%`, backgroundColor: isOver ? '#fb923c' : color }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workout plan tab
// ---------------------------------------------------------------------------

type WorkoutView = 'today' | 'calendar';

function WorkoutPlanTab({
  workoutPlan,
  schedule,
  progress,
  completedDates,
  onToggleSet,
  onSwapExercise,
  onRevertExercise,
  onQuickCompleteDay,
  onUndoCompleteDay,
  onSetSchedule,
  onClearSchedule,
}: {
  workoutPlan: WorkoutPlan;
  schedule: WorkoutScheduleEntry[];
  progress: SetProgressEntry[];
  completedDates: readonly string[];
  onToggleSet: (dayId: string, exerciseId: string, setIndex: number) => void;
  onSwapExercise: (dayId: string, exerciseId: string, alternative: ExerciseAlternative) => void;
  onRevertExercise: (dayId: string, exerciseId: string) => void;
  onQuickCompleteDay: (dayId: string, date?: string) => void;
  onUndoCompleteDay: (dayId: string, date?: string) => void;
  onSetSchedule: (date: string, dayId: string, customLabel?: string) => void;
  onClearSchedule: (date: string) => void;
}) {
  const [view, setView] = useState<WorkoutView>('today');
  const todaysDay = useMemo(() => getTodaysPlanDay(workoutPlan, schedule), [workoutPlan, schedule]);
  const [selectedDayId, setSelectedDayId] = useState<string>(todaysDay.id);
  const selectedDay = workoutPlan.days.find((d) => d.id === selectedDayId) ?? workoutPlan.days[0];
  const todaysDayCompleted = useMemo(
    () => completedDates.includes(todayIso()) || isDayCompleted(workoutPlan, progress, todayIso(), todaysDay.id),
    [workoutPlan, progress, todaysDay, completedDates],
  );

  return (
    <div className="flex flex-col gap-5">
      <HeroCarousel
        compact
        slides={[
          {
            id: 'workout-header',
            imageUrl: TAB_HERO_WORKOUT_IMAGE,
            eyebrow: 'תוכנית אימונים',
            headline: 'זמן לתת עבודה',
            body: workoutPlan.title,
          },
        ]}
      />

      <div className="inline-flex self-end rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
        <button
          type="button"
          onClick={() => setView('today')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            view === 'today' ? 'bg-lime-400 text-zinc-950' : 'text-zinc-600 dark:text-zinc-400'
          }`}
        >
          אימון היום
        </button>
        <button
          type="button"
          onClick={() => setView('calendar')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            view === 'calendar' ? 'bg-lime-400 text-zinc-950' : 'text-zinc-600 dark:text-zinc-400'
          }`}
        >
          לוח שנה
        </button>
      </div>

      {view === 'today' ? (
        <>
          <QuickCompleteButton
            day={todaysDay}
            isCompleted={todaysDayCompleted}
            onQuickCompleteDay={onQuickCompleteDay}
            onUndoCompleteDay={onUndoCompleteDay}
          />

          <RestTimerWidget />

          <WorkoutCard
            workoutPlan={workoutPlan}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDayId}
            onToggleSet={onToggleSet}
            onSwapExercise={onSwapExercise}
            onRevertExercise={onRevertExercise}
            progress={progress}
          />
        </>
      ) : (
        <WorkoutCalendar
          workoutPlan={workoutPlan}
          progress={progress}
          schedule={schedule}
          completedDates={completedDates}
          onSetSchedule={onSetSchedule}
          onClearSchedule={onClearSchedule}
          onQuickCompleteDay={onQuickCompleteDay}
          onUndoCompleteDay={onUndoCompleteDay}
        />
      )}
    </div>
  );
}

function WorkoutCard({
  workoutPlan,
  selectedDay,
  onSelectDay,
  onToggleSet,
  onSwapExercise,
  onRevertExercise,
  progress,
}: {
  workoutPlan: WorkoutPlan;
  selectedDay: DayWorkout;
  onSelectDay: (dayId: string) => void;
  onToggleSet: (dayId: string, exerciseId: string, setIndex: number) => void;
  onSwapExercise: (dayId: string, exerciseId: string, alternative: ExerciseAlternative) => void;
  onRevertExercise: (dayId: string, exerciseId: string) => void;
  progress: SetProgressEntry[];
}) {
  const date = todayIso();
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [swapExercise, setSwapExercise] = useState<Exercise | null>(null);
  const restTimer = useRestTimer();

  const totalSets = selectedDay.exercises.reduce((sum, e) => sum + e.sets, 0);
  const doneSets = selectedDay.exercises.reduce((sum, e) => {
    const entry = progress.find(
      (p) => p.dayId === selectedDay.id && p.exerciseId === e.id && p.date === date,
    );
    return sum + (entry?.completedSets ?? 0);
  }, 0);

  return (
    <div className="glass-card flex h-full flex-col p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Dumbbell className="h-5 w-5 text-lime-700 dark:text-lime-400" />
        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">{workoutPlan.title}</h2>
      </div>
      <p className="mb-4 text-xs text-zinc-600 dark:text-zinc-500">{workoutPlan.description}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {workoutPlan.days.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelectDay(d.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              d.id === selectedDay.id
                ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            {d.dayLabel}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-500">
          <span>{selectedDay.focus}</span>
          <span>
            {doneSets}/{totalSets} סטים הושלמו
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-lime-400 transition-all duration-300"
            style={{ width: totalSets > 0 ? `${(doneSets / totalSets) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {selectedDay.exercises.map((exercise) => {
          const entry = progress.find(
            (p) => p.dayId === selectedDay.id && p.exerciseId === exercise.id && p.date === date,
          );
          const completedSets = entry?.completedSets ?? 0;
          const isComplete = completedSets >= exercise.sets;

          return (
            <div
              key={exercise.id}
              className={`rounded-xl border p-3.5 transition sm:p-4 ${
                isComplete ? 'border-lime-500/30 bg-lime-400/5' : 'border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40'
              }`}
            >
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`font-semibold ${isComplete ? 'text-lime-700 dark:text-lime-300' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {exercise.name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500">
                    {exercise.repsRange} חזרות &middot; מנוחה {exercise.restSeconds} שנ׳
                  </p>
                  {exercise.replacedFrom && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-orange-400/10 px-1.5 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-400">
                      <Sparkles className="h-3 w-3" />
                      תרגיל מותאם אישית
                    </span>
                  )}
                </div>
                <ExerciseThumbnail exercise={exercise} onClick={() => setActiveExercise(exercise)} />
              </div>

              {(exercise.alternatives?.length || exercise.replacedFrom) && (
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  {exercise.alternatives && exercise.alternatives.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSwapExercise(exercise)}
                      className="flex items-center gap-1 rounded-lg border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[11px] font-semibold text-lime-700 dark:text-lime-400 transition hover:border-lime-400/70 hover:bg-lime-400/20"
                    >
                      <ArrowLeftRight className="h-3 w-3" />
                      החלף תרגיל
                    </button>
                  )}
                  {exercise.replacedFrom && (
                    <button
                      type="button"
                      onClick={() => onRevertExercise(selectedDay.id, exercise.id)}
                      className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 transition hover:border-zinc-400 dark:hover:border-zinc-600"
                    >
                      <RotateCcw className="h-3 w-3" />
                      חזרה לתרגיל המקורי
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {Array.from({ length: exercise.sets }).map((_, i) => {
                  const setDone = i < completedSets;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const isCompletingNewSet = i >= completedSets;
                        onToggleSet(selectedDay.id, exercise.id, i);
                        if (isCompletingNewSet) {
                          // start() unlocks Web Audio and asks for notification permission, which both must
                          // happen synchronously inside this click - iOS only allows them within a user gesture.
                          restTimer.start(exercise.restSeconds, exercise.name);
                        }
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition active:scale-90 ${
                        setDone
                          ? 'border-lime-400 bg-lime-400 text-zinc-950'
                          : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-600'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <VideoModal exercise={activeExercise} onClose={() => setActiveExercise(null)} />
      <ExerciseSwapModal
        exercise={swapExercise}
        onClose={() => setSwapExercise(null)}
        onSwap={(alternative) => {
          if (swapExercise) onSwapExercise(selectedDay.id, swapExercise.id, alternative);
          setSwapExercise(null);
        }}
      />
    </div>
  );
}

function ExerciseThumbnail({ exercise, onClick }: { exercise: Exercise; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`הדגמת וידאו: ${exercise.name}`}
      className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 transition hover:border-lime-400/50 active:scale-95 sm:h-20 sm:w-20"
    >
      {exercise.youtubeId ? (
        <>
          <img
            src={`https://img.youtube.com/vi/${exercise.youtubeId}/mqdefault.jpg`}
            alt={exercise.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 transition group-hover:bg-black/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-400 text-zinc-950 shadow-glow transition group-hover:scale-110 sm:h-8 sm:w-8">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
          </div>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-500 dark:text-zinc-600">
          <Dumbbell className="h-6 w-6" />
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Progress tab (weight tracking + photos)
// ---------------------------------------------------------------------------

function ProgressTab({
  weightLogs,
  progressPhotos,
  goal,
  goalIntensity,
  onSaveWeightLog,
  onBulkImportWeightLogs,
  onDeleteWeightLog,
  onAddPhoto,
  onDeletePhoto,
  onUpdatePhoto,
  onApplyCalorieAdjustment,
  appState,
}: {
  weightLogs: WeightLog[];
  progressPhotos: ProgressPhoto[];
  goal: Goal;
  goalIntensity?: GoalIntensity;
  onSaveWeightLog: (date: string, weightKg: number, notes?: string) => void;
  onBulkImportWeightLogs: (entries: BulkWeightEntry[]) => void;
  onDeleteWeightLog: (id: string) => void;
  onAddPhoto: (photo: Omit<ProgressPhoto, 'id'>) => Promise<void>;
  onDeletePhoto: (id: string) => void;
  onUpdatePhoto: (id: string, patch: Partial<Pick<ProgressPhoto, 'date' | 'weightKg'>>) => void;
  onApplyCalorieAdjustment: (deltaKcal: number) => void;
  appState: AppState;
}) {
  return (
    <div className="flex flex-col gap-6">
      <HeroCarousel
        compact
        slides={[
          {
            id: 'progress-header',
            imageUrl: TAB_HERO_PROGRESS_IMAGE,
            eyebrow: 'מעקב התקדמות',
            headline: 'עקביות מנצחת הכל',
            body: 'שקילות, ממוצעים שבועיים ותמונות התקדמות במקום אחד',
          },
        ]}
      />

      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-lime-700 dark:text-lime-400" />
        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">משקל</h2>
      </div>
      <WeightTracker
        logs={weightLogs}
        onSave={onSaveWeightLog}
        onDelete={onDeleteWeightLog}
        onBulkImport={onBulkImportWeightLogs}
      />

      <div className="mt-2 flex items-center gap-2">
        <Camera className="h-4 w-4 text-lime-700 dark:text-lime-400" />
        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">תמונות</h2>
      </div>
      <ProgressPhotos
        photos={progressPhotos}
        weightLogs={weightLogs}
        goal={goal}
        goalIntensity={goalIntensity}
        onAdd={onAddPhoto}
        onDelete={onDeletePhoto}
        onUpdate={onUpdatePhoto}
        onSaveWeightLog={onSaveWeightLog}
        appState={appState}
        onApplyCalorieAdjustment={onApplyCalorieAdjustment}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile tab
// ---------------------------------------------------------------------------

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'ירידה במשקל',
  maintain: 'שמירה על המשקל',
  gain_muscle: 'מסה מבוקרת (Lean Bulk)',
  recomp: 'שיפור הרכב גוף',
};

const GOAL_INTENSITY_LABELS: Record<string, string> = {
  moderate: 'קצב מתון',
  aggressive: 'קצב אגרסיבי',
};

const EXPERIENCE_YEARS_LABELS: Record<string, string> = {
  under_1y: 'פחות משנה',
  '1_3y': '1-3 שנים',
  over_3y: 'מעל 3 שנים',
};

const CURRENT_SPLIT_LABELS: Record<string, string> = {
  fbw: 'Full Body (FBW)',
  upper_lower: 'Upper / Lower',
  ppl: 'Push / Pull / Legs',
  custom: 'תוכנית אישית',
};

const FOCUS_AREA_DISPLAY_LABELS: Record<string, string> = {
  upper_chest: 'חזה עליון',
  back_width: 'גב ורוחב',
  shoulders: 'כתפיים',
  legs_glutes: 'רגליים/ישבן',
  arms: 'זרועות',
};

const INJURY_DISPLAY_LABELS: Record<string, string> = {
  shoulder: 'כתף',
  lower_back: 'גב תחתון',
  knees: 'ברכיים',
};

function ProfileTab({
  appState,
  onApplyProgram,
  onUpdateProfileFull,
  onSaveCircumferenceEntry,
  onDeleteCircumferenceEntry,
  onSaveCircumferenceGoals,
  onImportAppState,
  onBulkImportWeightLogs,
  onNavigate,
  onRequestReset,
  onLogout,
  onStartTour,
}: {
  appState: AppState;
  onApplyProgram: (split: WorkoutSplitType, days: TrainingDaysPerWeek) => void;
  onUpdateProfileFull: (updates: Partial<UserMetrics>) => void;
  onSaveCircumferenceEntry: (date: string, measurements: BodyMeasurements) => void;
  onDeleteCircumferenceEntry: (id: string) => void;
  onSaveCircumferenceGoals: (goals: CircumferenceGoals) => void;
  onImportAppState: (data: AppState) => Promise<void>;
  onBulkImportWeightLogs: (entries: BulkWeightEntry[]) => void;
  onNavigate: (tab: Tab) => void;
  onRequestReset: () => void;
  onLogout: () => void;
  onStartTour: () => void;
}) {
  const { profile, nutritionPlan } = appState;
  const { metrics } = profile;
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [pendingImport, setPendingImport] = useState<
    | { kind: 'full'; state: AppState; skipped: number; summary: RestoreSummary }
    | { kind: 'weights'; entries: BulkWeightEntry[]; skipped: number; summary: RestoreSummary }
    | null
  >(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function handleSaveProfile(updates: Partial<UserMetrics>) {
    onUpdateProfileFull(updates);
    setIsEditProfileOpen(false);
    setToastMessage('הפרופיל והיעדים עודכנו בהצלחה');
  }

  function handleExportData() {
    const payload = { version: 1, exportedAt: new Date().toISOString(), appState };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `macrolift-backup-${todayIso()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastMessage('הנתונים יוצאו בהצלחה');
  }

  function handleExportCsv() {
    const csv = buildAppStateCsv(appState);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'macrolift-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToastMessage('קובץ ה-CSV יוצא בהצלחה');
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const result = parseBackupFile(await file.text(), appState);
      if (!result.ok) {
        setRestoreResult({ kind: 'error', message: result.error });
        return;
      }
      setPendingImport(
        result.kind === 'full'
          ? { kind: 'full', state: result.state, skipped: result.skippedEntries, summary: result.summary }
          : { kind: 'weights', entries: result.entries, skipped: result.skippedEntries, summary: result.summary },
      );
    } catch {
      setRestoreResult({ kind: 'error', message: 'לא ניתן לקרוא את הקובץ שנבחר.' });
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    const pending = pendingImport;
    setPendingImport(null);
    try {
      if (pending.kind === 'weights') onBulkImportWeightLogs(pending.entries);
      else await onImportAppState(pending.state);
      setRestoreResult({ kind: 'success', summary: pending.summary, skipped: pending.skipped });
    } catch {
      setRestoreResult({ kind: 'error', message: 'האחסון המקומי במכשיר מלא, ולכן השחזור לא הושלם.' });
    }
  }

  const rows = useMemo(
    () => [
      { icon: UserIcon, label: 'מין', value: metrics.gender === 'male' ? 'זכר' : 'נקבה' },
      { icon: Flame, label: 'גיל', value: `${metrics.age} שנים` },
      { icon: Ruler, label: 'גובה', value: `${metrics.heightCm} ס״מ` },
      { icon: Weight, label: 'משקל', value: `${metrics.weightKg} ק״ג` },
      { icon: Footprints, label: 'ממוצע צעדים', value: `${metrics.averageDailySteps}` },
      { icon: Dumbbell, label: 'ימי אימון בשבוע', value: `${metrics.trainingDaysPerWeek}` },
    ],
    [metrics],
  );

  return (
    <div className="flex flex-col gap-6">
      <HeroCarousel
        compact
        slides={[
          {
            id: 'profile-header',
            imageUrl: TAB_HERO_PROFILE_IMAGE,
            eyebrow: profile.name,
            headline: 'פרופיל אישי והאקדמיה',
          },
        ]}
      />

      <div className="glass-card p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-lime-400/30 bg-lime-400/10 px-3 py-1.5 text-xs font-semibold text-lime-700 dark:text-lime-400">
              {GOAL_LABELS[metrics.goal]}
            </span>
            <span className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {BODY_TYPE_OPTIONS.find((o) => o.value === metrics.bodyState)?.label}
            </span>
            {metrics.goal === 'gain_muscle' && (
              <span className="rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                {GOAL_INTENSITY_LABELS[metrics.goalIntensity ?? 'moderate']}
              </span>
            )}
            {metrics.goal === 'gain_muscle' && metrics.bulkingPlan && (
              <span className="rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                תקופת מסה: {metrics.bulkingPlan.durationMonths} חודשים
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsEditProfileOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
          >
            <Pencil className="h-3.5 w-3.5" />
            עריכת פרטים
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-zinc-600 dark:text-zinc-500">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[11px]">{label}</span>
              </div>
              <p className="font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigate('academy')}
        className="glass-card flex items-center gap-4 p-5 text-right transition hover:border-lime-400/30 hover:shadow-glow sm:p-6"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
          <BookOpen className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">MacroLift Academy</h2>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500">מדריכים וטיפים מקצועיים לתזונה, אימון והתאוששות</p>
        </div>
        <ChevronLeft className="h-5 w-5 shrink-0 text-zinc-400" />
      </button>

      <Settings metrics={metrics} currentSplit={appState.workoutPlan.splitType} onApplyProgram={onApplyProgram} />

      <div className="glass-card p-5 sm:p-6">
        <h2 className="mb-3 font-bold text-zinc-900 dark:text-zinc-100">חישוב קלורי</h2>
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-500">BMR</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{nutritionPlan.bmr}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-500">TDEE</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{nutritionPlan.tdee}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-500">יעד</p>
            <p className="text-lg font-bold text-lime-700 dark:text-lime-400">{nutritionPlan.targetCalories}</p>
          </div>
        </div>
        <TransparencyModal metrics={metrics} nutritionPlan={nutritionPlan} variant="button" />
      </div>

      <CircumferenceTracker
        logs={appState.circumferenceLogs}
        goals={appState.circumferenceGoals}
        goal={metrics.goal}
        experienceYears={metrics.experience?.experienceYears}
        bulkingPlan={metrics.bulkingPlan}
        onSaveEntry={onSaveCircumferenceEntry}
        onDeleteEntry={onDeleteCircumferenceEntry}
        onSaveGoals={onSaveCircumferenceGoals}
      />

      {metrics.experience?.isCurrentlyTraining && (
        <div className="glass-card p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-lime-700 dark:text-lime-400" />
            <h2 className="font-bold text-zinc-900 dark:text-zinc-100">ניסיון אימונים</h2>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {metrics.experience.experienceYears && (
              <span className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                ותק: {EXPERIENCE_YEARS_LABELS[metrics.experience.experienceYears]}
              </span>
            )}
            {metrics.experience.currentSplit && (
              <span className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Split: {CURRENT_SPLIT_LABELS[metrics.experience.currentSplit]}
              </span>
            )}
            {metrics.experience.hasPlateau && (
              <span className="rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                מדווח על פלאטו
              </span>
            )}
          </div>

          {metrics.experience.focusAreas && metrics.experience.focusAreas.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs text-zinc-600 dark:text-zinc-500">נקודות לחיזוק</p>
              <div className="flex flex-wrap gap-1.5">
                {metrics.experience.focusAreas.map((area) => (
                  <span key={area} className="rounded-md bg-white/60 dark:bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                    {FOCUS_AREA_DISPLAY_LABELS[area]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {metrics.experience.injuries && metrics.experience.injuries.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-500">
                <AlertTriangle className="h-3 w-3" />
                מגבלות / פציעות
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metrics.experience.injuries.map((injury) => (
                  <span key={injury} className="rounded-md bg-orange-400/10 px-2 py-1 text-[11px] text-orange-700 dark:text-orange-300">
                    {INJURY_DISPLAY_LABELS[injury]}
                  </span>
                ))}
              </div>
              {metrics.experience.injuryNotes && (
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">{metrics.experience.injuryNotes}</p>
              )}
            </div>
          )}
        </div>
      )}

      {metrics.measurements && Object.keys(metrics.measurements).length > 0 && (
        <div className="glass-card p-5 sm:p-6">
          <h2 className="mb-3 font-bold text-zinc-900 dark:text-zinc-100">היקפי גוף</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.measurements.waistCm !== undefined && (
              <MeasurementStat label="מותן" value={metrics.measurements.waistCm} />
            )}
            {metrics.measurements.armCm !== undefined && (
              <MeasurementStat label="זרוע" value={metrics.measurements.armCm} />
            )}
            {metrics.measurements.chestCm !== undefined && (
              <MeasurementStat label="חזה" value={metrics.measurements.chestCm} />
            )}
            {metrics.measurements.hipCm !== undefined && (
              <MeasurementStat label="ירך" value={metrics.measurements.hipCm} />
            )}
          </div>
        </div>
      )}

      <div className="glass-card p-5 sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">מדריך ועזרה</h2>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
          סיור קצר בכלים המרכזיים, והדרכה להתקנה על אייפון ומחשב, העברת נתונים בין מכשירים ושאלות נפוצות.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onStartTour} className="btn-primary">
            <Rocket className="h-4 w-4" />
            סיור מודרך באפליקציה 🚀
          </button>
          <button type="button" onClick={() => setIsHelpOpen(true)} className="btn-secondary">
            <HelpCircle className="h-4 w-4" />
            מרכז עזרה ומדריך מכשירים
          </button>
        </div>
      </div>

      <div data-tour="backup" className="glass-card p-5 sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <Database className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">ניהול וגיבוי נתונים</h2>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
          ייצוא גיבוי מלא של הנתונים שלך לקובץ JSON, שחזור נתונים ממכשיר אחר או מגיבוי קודם, או ייצוא
          היסטוריית שקילות/תזונה/אימונים לקובץ CSV לניתוח באקסל.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleExportData} className="btn-secondary">
            <Download className="h-4 w-4" />
            גיבוי נתונים (JSON)
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()} className="btn-secondary">
            <Upload className="h-4 w-4" />
            שחזור מגיבוי
          </button>
          <button type="button" onClick={handleExportCsv} className="btn-secondary">
            <FileSpreadsheet className="h-4 w-4" />
            ייצוא לאקסל (CSV)
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRequestReset}
          className="btn-secondary text-red-400 hover:border-red-500/40 hover:bg-red-500/5"
        >
          <RotateCcw className="h-4 w-4" />
          איפוס נתונים והתחלה מחדש
        </button>
        <button type="button" onClick={onLogout} className="btn-secondary md:hidden">
          <LogOut className="h-4 w-4" />
          התנתקות
        </button>
      </div>

      {isEditProfileOpen && (
        <EditProfileModal metrics={metrics} onSave={handleSaveProfile} onClose={() => setIsEditProfileOpen(false)} />
      )}

      {pendingImport && (
        <ImportConfirmModal
          weightsOnlyCount={pendingImport.kind === 'weights' ? pendingImport.entries.length : undefined}
          onConfirm={confirmImport}
          onClose={() => setPendingImport(null)}
        />
      )}

      {isHelpOpen && <HelpCenterModal onClose={() => setIsHelpOpen(false)} />}

      {restoreResult && <RestoreResultModal result={restoreResult} onClose={() => setRestoreResult(null)} />}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </div>
  );
}

function MeasurementStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3 text-center">
      <p className="text-xs text-zinc-600 dark:text-zinc-500">{label}</p>
      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
        {value}
        <span className="mr-1 text-xs font-normal text-zinc-600 dark:text-zinc-500">ס״מ</span>
      </p>
    </div>
  );
}
