import { useEffect, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import Auth from './components/Auth';
import { clearSession, getSessionUserId } from './utils/authStorage';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import AICoachDrawer from './components/AICoachDrawer';
import { sanitizeAppState } from './utils/dataMigration';
import { ensureGuestSession } from './utils/localProfiles';
import { GUEST_USER_ID, isGuestFlagSet } from './utils/guestSession';
import { getWeekStart, todayIso } from './utils/weightCalculations';
import { storageService } from './services/storageService';
import type {
  AppState,
  BodyMeasurements,
  CircumferenceEntry,
  CircumferenceGoals,
  Exercise,
  ExerciseAlternative,
  FoodEntry,
  FoodTemplate,
  ProgressPhoto,
  SetLog,
  SetProgressEntry,
  TrainingDaysPerWeek,
  UserMetrics,
  UserProfile,
  WeightLog,
  WorkoutScheduleEntry,
  WorkoutSplitType,
} from './types/fitness';
import type { NutritionPlan, WorkoutPlan } from './types/fitness';
import { calculateMacros, calculateNutritionPlan } from './utils/calculations';
import { suggestSplitType } from './data/workoutTemplates';
import { buildWorkoutProgram, trainingSetupChanged } from './utils/programSelection';
import { applyStepGoal, followProfileSteps } from './utils/stepGoalSync';
import { buildSwappedExercise, revertSwappedExercise } from './utils/exerciseSwap';
import type { BulkWeightEntry } from './utils/bulkWeightParser';
import { distributeProgramSchedule, isDayCompleted, pruneStaleSchedule } from './utils/scheduleHelpers';
import { toggleSetEntry, updateSetLogEntry } from './utils/setLogs';
import { addSavedMeal, toggleFavoriteFood } from './utils/foodShortcuts';
import { saveStepsForDate } from './utils/stepsCalculations';
import { requestPersistentStorage } from './utils/persistentStorage';
import UpdatePrompt from './components/UpdatePrompt';
import StandaloneRestorePrompt from './components/StandaloneRestorePrompt';
import { hasSeenStandaloneWelcome, hasSeenWelcomeGuide, isStandalone, markStandaloneWelcomeSeen, markWelcomeGuideSeen } from './utils/pwaInstall';
import WelcomeGuide from './components/WelcomeGuide';
import PullToRefresh from './components/PullToRefresh';
import type { RebalanceChoice } from './components/RebalanceModal';
import { getActiveAdjustment } from './utils/weeklyBalance';

async function loadState(userId: string): Promise<AppState | null> {
  // Boot already repaired what's on disk; this keeps the in-memory copy safe too (e.g. after a restore or an unwritable repair).
  return sanitizeAppState(await storageService.getAppState(userId));
}

/**
 * Switches the active workout program: rebuilds the plan from the template (with the user's personalization), recalculates
 * nutrition for the new training frequency, spreads the workouts over the coming weeks of the calendar, and keeps credit for
 * workouts already completed under the old program.
 */
function applyProgramToState(
  prev: AppState,
  splitType: WorkoutSplitType,
  daysPerWeek: TrainingDaysPerWeek,
  metricsUpdates: Partial<UserMetrics> = {},
): AppState {
  const updatedMetrics: UserMetrics = { ...prev.profile.metrics, ...metricsUpdates, trainingDaysPerWeek: daysPerWeek };
  const newWorkoutPlan = buildWorkoutProgram(updatedMetrics, splitType, daysPerWeek);

  // The old plan's day ids/exercises are about to disappear, so completed days are remembered by date.
  const completed = new Set(prev.completedWorkoutDates ?? []);
  for (const date of new Set(prev.progress.map((p) => p.date))) {
    if (isDayCompleted(prev.workoutPlan, prev.progress, date)) completed.add(date);
  }

  // Rest / custom days survive; the new program's workouts are placed around them.
  const schedule = distributeProgramSchedule(newWorkoutPlan, pruneStaleSchedule(prev.schedule, newWorkoutPlan), undefined, undefined, [...completed]);

  return {
    ...prev,
    profile: { ...prev.profile, metrics: updatedMetrics },
    workoutPlan: newWorkoutPlan,
    schedule,
    nutritionPlan: calculateNutritionPlan(updatedMetrics),
    completedWorkoutDates: [...completed].sort(),
  };
}

const BOOT_TIMEOUT_MS = 1500;

/**
 * Saves a hand-built plan: it replaces the current one, the calendar is re-spread around the new sessions (workouts already marked done
 * keep their credit), and the weekly training frequency - which feeds the calorie estimate - follows the number of sessions.
 */
function applyCustomPlanToState(prev: AppState, plan: WorkoutPlan): AppState {
  const completed = new Set(prev.completedWorkoutDates ?? []);
  for (const date of new Set(prev.progress.map((p) => p.date))) {
    if (isDayCompleted(prev.workoutPlan, prev.progress, date)) completed.add(date);
  }
  const metrics: UserMetrics = { ...prev.profile.metrics, trainingDaysPerWeek: plan.daysPerWeek };
  return {
    ...prev,
    profile: { ...prev.profile, metrics },
    workoutPlan: plan,
    schedule: distributeProgramSchedule(plan, pruneStaleSchedule(prev.schedule, plan), undefined, undefined, [...completed]),
    nutritionPlan: calculateNutritionPlan(metrics),
    completedWorkoutDates: [...completed].sort(),
  };
}

export default function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState | null>(null);
  const [isStandaloneWelcomeOpen, setIsStandaloneWelcomeOpen] = useState(false);
  const [isWelcomeGuideOpen, setIsWelcomeGuideOpen] = useState(false);

  // Stored data that can't be read must reach the error screen (with its reset button), not leave the boot spinner up forever.
  const [bootError, setBootError] = useState<Error | null>(null);
  if (bootError) throw bootError;

  useEffect(() => {
    (async () => {
      try {
        let sessionUserId = await getSessionUserId();
        // A guest never lands on the sign-in screen after a refresh: if the session pointer is gone but the guest flag is set, reopen the guest.
        if (!sessionUserId && isGuestFlagSet()) sessionUserId = await ensureGuestSession();
        setUserId(sessionUserId);
        if (sessionUserId) {
          let loaded = await loadState(sessionUserId);
          // A guest whose data is missing or unreadable is recreated with defaults rather than sent through onboarding.
          if (!loaded && sessionUserId === GUEST_USER_ID) {
            await ensureGuestSession();
            loaded = await loadState(sessionUserId);
          }
          setAppState(loaded);
        }
        else if ((await storageService.getUsers()).length === 0) {
          // First launch of the installed app on a device with no profile yet: offer to load a backup instead of showing an empty app.
          if (isStandalone() && !hasSeenStandaloneWelcome()) setIsStandaloneWelcomeOpen(true);
          // A brand-new device in a browser: the short introduction (data stays on the device, install first, how to back up).
          else if (!hasSeenWelcomeGuide()) setIsWelcomeGuideOpen(true);
        }
      } catch (err) {
        setBootError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsBooting(false);
      }
    })();
  }, []);

  // Safety net: whatever happens to the storage reads above, the boot screen never stays up longer than this. A load that finishes
  // later still updates the app when it completes.
  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Best-effort and independent of the boot sequence above - never gates hydration.
    void requestPersistentStorage();
  }, []);

  useEffect(() => {
    // Fire-and-forget: a write failure here (e.g. quota exceeded) has no direct user action
    // to report back to, so it's swallowed - unlike the eager, awaited save in handleAddPhoto.
    if (userId && appState) storageService.saveAppState(userId, appState).catch(() => {});
  }, [userId, appState]);

  async function handleAuthenticated(newUserId: string) {
    setUserId(newUserId);
    setAppState(await loadState(newUserId));
  }

  /**
   * Pull-to-refresh: asks the service worker to check for a newer app version (the update prompt appears if one exists)
   * and re-reads the saved data from storage, so edits made in another tab or window show up.
   */
  async function handleRefresh() {
    try {
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
      await registration?.update();
    } catch {
      // Offline or no service worker (dev): refreshing the data below still works.
    }
    if (userId) {
      const fresh = await loadState(userId);
      if (fresh) setAppState(fresh);
    }
  }

  function handleOnboardingComplete(
    profile: UserProfile,
    nutritionPlan: NutritionPlan,
    workoutPlan: WorkoutPlan,
  ) {
    setAppState({
      profile,
      nutritionPlan,
      workoutPlan,
      progress: [],
      weightLogs: [],
      progressPhotos: [],
      schedule: [],
      foodLog: [],
      stepLogs: [],
      circumferenceLogs: [],
      circumferenceGoals: {},
    });
  }

  function handleReset() {
    if (userId) storageService.deleteAppState(userId);
    setAppState(null);
  }

  function handleLogout() {
    clearSession();
    setUserId(null);
    setAppState(null);
  }

  /** Ticks (or un-ticks) a set, storing the weight / reps typed for it. Logs to today unless a date is given. */
  function toggleSet(dayId: string, exercise: Pick<Exercise, 'id' | 'name'>, setIndex: number, log?: SetLog, date: string = todayIso()) {
    setAppState((prev) =>
      prev
        ? { ...prev, progress: toggleSetEntry(prev.progress, { dayId, exerciseId: exercise.id, exerciseName: exercise.name, date, setIndex, log }) }
        : prev,
    );
  }

  /** Corrects the weight / reps of a set that was already ticked (today, or on the date being logged). */
  function updateSetLog(dayId: string, exercise: Pick<Exercise, 'id' | 'name'>, setIndex: number, log: SetLog, date: string = todayIso()) {
    setAppState((prev) =>
      prev
        ? { ...prev, progress: updateSetLogEntry(prev.progress, { dayId, exerciseId: exercise.id, exerciseName: exercise.name, date, setIndex, log }) }
        : prev,
    );
  }

  function handleSaveWeightLog(date: string, weightKg: number, notes?: string) {
    setAppState((prev) => {
      if (!prev) return prev;
      const existing = prev.weightLogs.find((l) => l.date === date);
      const entry: WeightLog = { id: existing?.id ?? crypto.randomUUID(), date, weightKg, notes };
      const withoutEntry = prev.weightLogs.filter((l) => l.date !== date);
      return { ...prev, weightLogs: [...withoutEntry, entry] };
    });
  }

  /** Merges a bulk-pasted batch of weigh-ins into the existing history (same date -> update, new date -> add), then re-sorts chronologically. */
  function handleBulkImportWeightLogs(entries: BulkWeightEntry[]) {
    setAppState((prev) => {
      if (!prev) return prev;
      const byDate = new Map(prev.weightLogs.map((log) => [log.date, log]));
      for (const entry of entries) {
        const existing = byDate.get(entry.date);
        byDate.set(entry.date, {
          id: existing?.id ?? crypto.randomUUID(),
          date: entry.date,
          weightKg: entry.weightKg,
          notes: existing?.notes,
        });
      }
      const weightLogs = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return { ...prev, weightLogs };
    });
  }

  function handleDeleteWeightLog(id: string) {
    setAppState((prev) => (prev ? { ...prev, weightLogs: prev.weightLogs.filter((l) => l.id !== id) } : prev));
  }

  /**
   * Unlike other mutations (which go through the generic fire-and-forget autosave effect),
   * this persists eagerly and awaits the write before touching React state: a progress photo
   * is the mutation most likely to hit the localStorage quota, and the caller (ProgressPhotos)
   * needs to know synchronously whether it actually saved, so it can show a specific error
   * instead of the photo silently disappearing on the next reload.
   */
  async function handleAddPhoto(photo: Omit<ProgressPhoto, 'id'>): Promise<void> {
    if (!appState || !userId) return;
    const entry: ProgressPhoto = { ...photo, id: crypto.randomUUID() };
    const nextState = { ...appState, progressPhotos: [...appState.progressPhotos, entry] };
    await storageService.saveAppState(userId, nextState);
    setAppState(nextState);
  }

  /** Edits a progress photo's date and/or weight snapshot in place (the image itself is untouched, so this never risks the storage quota). */
  function handleUpdatePhoto(id: string, patch: Partial<Pick<ProgressPhoto, 'date' | 'weightKg'>>) {
    setAppState((prev) =>
      prev ? { ...prev, progressPhotos: prev.progressPhotos.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : prev,
    );
  }

  function handleDeletePhoto(id: string) {
    setAppState((prev) =>
      prev ? { ...prev, progressPhotos: prev.progressPhotos.filter((p) => p.id !== id) } : prev,
    );
  }

  /** Applies an AI progress-review's suggested daily calorie delta, recomputing macros for the new target. */
  function handleApplyCalorieAdjustment(deltaKcal: number) {
    setAppState((prev) => {
      if (!prev) return prev;
      const targetCalories = Math.max(prev.nutritionPlan.targetCalories + deltaKcal, 0);
      const macros = calculateMacros(targetCalories, prev.profile.metrics.weightKg, prev.profile.metrics.gender);
      return {
        ...prev,
        nutritionPlan: {
          ...prev.nutritionPlan,
          targetCalories,
          macros,
          calorieDeficitOrSurplus: Math.round(targetCalories - prev.nutritionPlan.tdee),
        },
      };
    });
  }

  /** Bulk-marks every exercise of a plan day as fully completed on the given date (defaults to today). */
  function handleQuickCompleteDay(dayId: string, date: string = todayIso()) {
    setAppState((prev) => {
      if (!prev) return prev;
      const day = prev.workoutPlan.days.find((d) => d.id === dayId);
      if (!day) return prev;

      const withoutDay = prev.progress.filter((p) => !(p.dayId === dayId && p.date === date));
      const completedEntries: SetProgressEntry[] = day.exercises.map((ex) => ({
        dayId,
        exerciseId: ex.id,
        date,
        completedSets: ex.sets,
      }));
      const completedWorkoutDates = prev.completedWorkoutDates?.includes(date)
        ? prev.completedWorkoutDates
        : [...(prev.completedWorkoutDates ?? []), date];
      return { ...prev, progress: [...withoutDay, ...completedEntries], completedWorkoutDates };
    });
  }

  function handleSetSchedule(date: string, dayId: string, customLabel?: string) {
    setAppState((prev) => {
      if (!prev) return prev;
      const withoutDate = prev.schedule.filter((s) => s.date !== date);
      const entry: WorkoutScheduleEntry = { date, dayId, customLabel };
      return { ...prev, schedule: [...withoutDate, entry] };
    });
  }

  /** Clears both the day's scheduled workout AND any completed-set records for that date, so the calendar/dashboard stop showing it as done. */
  function handleClearSchedule(date: string) {
    setAppState((prev) =>
      prev
        ? {
            ...prev,
            schedule: prev.schedule.filter((s) => s.date !== date),
            progress: prev.progress.filter((p) => p.date !== date),
            completedWorkoutDates: prev.completedWorkoutDates?.filter((d) => d !== date),
          }
        : prev,
    );
  }

  /** Reverses handleQuickCompleteDay - removes the completed-set records for one day/date, undoing "מסומן כהושלם". */
  function handleUndoCompleteDay(dayId: string, date: string = todayIso()) {
    setAppState((prev) =>
      prev
        ? {
            ...prev,
            progress: prev.progress.filter((p) => !(p.dayId === dayId && p.date === date)),
            // Un-marking a date also drops it from the marked-dates list, otherwise it would keep counting as trained.
            completedWorkoutDates: prev.completedWorkoutDates?.filter((d) => d !== date),
          }
        : prev,
    );
  }

  function handleAddFood(entry: Omit<FoodEntry, 'id'>) {
    setAppState((prev) => {
      if (!prev) return prev;
      const newEntry: FoodEntry = {
        ...entry,
        id: crypto.randomUUID(),
        time: entry.time ?? new Date().toTimeString().slice(0, 5),
      };
      return { ...prev, foodLog: [...prev.foodLog, newEntry] };
    });
  }

  /** Stars a logged food (or un-stars it) so it can be added again in one tap. */
  function handleToggleFavorite(entry: FoodEntry | FoodTemplate) {
    setAppState((prev) => (prev ? { ...prev, favoriteFoods: toggleFavoriteFood(prev.favoriteFoods ?? [], entry) } : prev));
  }

  function handleSaveMeal(name: string, entries: FoodEntry[]) {
    setAppState((prev) => (prev ? { ...prev, savedMeals: addSavedMeal(prev.savedMeals ?? [], name, entries) } : prev));
  }

  function handleDeleteSavedMeal(id: string) {
    setAppState((prev) => (prev ? { ...prev, savedMeals: (prev.savedMeals ?? []).filter((m) => m.id !== id) } : prev));
  }

  function handleDeleteFood(id: string) {
    setAppState((prev) => (prev ? { ...prev, foodLog: prev.foodLog.filter((f) => f.id !== id) } : prev));
  }

  /** Applies an in-place edit to a logged food entry (e.g. correcting an AI-estimated value). */
  function handleUpdateFood(id: string, updates: Partial<Omit<FoodEntry, 'id' | 'date' | 'meal'>>) {
    setAppState((prev) =>
      prev
        ? { ...prev, foodLog: prev.foodLog.map((f) => (f.id === id ? { ...f, ...updates } : f)) }
        : prev,
    );
  }

  /** Upserts the step count for one date (replaces any existing entry for that date). */
  function handleSaveSteps(date: string, steps: number) {
    setAppState((prev) => {
      if (!prev) return prev;
      return { ...prev, stepLogs: saveStepsForDate(prev.stepLogs, date, steps) };
    });
  }

  function handleSaveStepGoal(goal: number, mode: 'weekly' | 'daily') {
    setAppState((prev) => (prev ? applyStepGoal(prev, goal, mode) : prev));
  }

  /** Upserts a circumference check-in for one date (replaces any existing entry for that date). */
  function handleSaveCircumferenceEntry(date: string, measurements: BodyMeasurements) {
    setAppState((prev) => {
      if (!prev) return prev;
      const existing = prev.circumferenceLogs.find((c) => c.date === date);
      const entry: CircumferenceEntry = { id: existing?.id ?? crypto.randomUUID(), date, ...measurements };
      const withoutDate = prev.circumferenceLogs.filter((c) => c.date !== date);
      return { ...prev, circumferenceLogs: [...withoutDate, entry] };
    });
  }

  function handleDeleteCircumferenceEntry(id: string) {
    setAppState((prev) =>
      prev ? { ...prev, circumferenceLogs: prev.circumferenceLogs.filter((c) => c.id !== id) } : prev,
    );
  }

  function handleSaveCircumferenceGoals(goals: CircumferenceGoals) {
    setAppState((prev) => (prev ? { ...prev, circumferenceGoals: goals } : prev));
  }

  /** Swaps one exercise in the active plan for a physiologically-equivalent alternative, keeping its sets/rest. */
  function handleSwapExercise(dayId: string, exerciseId: string, alternative: ExerciseAlternative) {
    setAppState((prev) => {
      if (!prev) return prev;
      const days = prev.workoutPlan.days.map((day) => {
        if (day.id !== dayId) return day;
        return {
          ...day,
          exercises: day.exercises.map((exercise) =>
            exercise.id === exerciseId ? buildSwappedExercise(exercise, alternative) : exercise,
          ),
        };
      });
      return { ...prev, workoutPlan: { ...prev.workoutPlan, days } };
    });
  }

  /** Restores a swapped exercise back to the one originally in the plan. */
  function handleRevertExercise(dayId: string, exerciseId: string) {
    setAppState((prev) => {
      if (!prev) return prev;
      const days = prev.workoutPlan.days.map((day) => {
        if (day.id !== dayId) return day;
        return {
          ...day,
          exercises: day.exercises.map((exercise) =>
            exercise.id === exerciseId ? revertSwappedExercise(exercise) : exercise,
          ),
        };
      });
      return { ...prev, workoutPlan: { ...prev.workoutPlan, days } };
    });
  }

  /** Full profile edit from the Profile tab - recalculates nutrition targets immediately, and regenerates the workout plan when the weekly training frequency changed. */
  function handleUpdateProfileFull(updates: Partial<UserMetrics>) {
    setAppState((current) => {
      if (!current) return current;
      const compute = (prev: AppState): AppState => {
        const updatedMetrics = { ...prev.profile.metrics, ...updates };
        const newNutritionPlan = calculateNutritionPlan(updatedMetrics);

        // A plan the user built by hand is never regenerated behind their back: only the profile and the calorie targets change.
        if (prev.workoutPlan.isCustom) {
          return { ...prev, profile: { ...prev.profile, metrics: updatedMetrics }, nutritionPlan: newNutritionPlan };
        }

        // Another training place, equipment or level means a different program, even at the same frequency.
        if (trainingSetupChanged(prev.profile.metrics, updatedMetrics)) {
          return applyProgramToState(prev, suggestSplitType(updatedMetrics.trainingDaysPerWeek), updatedMetrics.trainingDaysPerWeek, updates);
        }

        if (updates.trainingDaysPerWeek && updates.trainingDaysPerWeek !== prev.profile.metrics.trainingDaysPerWeek) {
          return applyProgramToState(prev, suggestSplitType(updates.trainingDaysPerWeek), updates.trainingDaysPerWeek, updates);
        }

        // A new muscle emphasis rebuilds the current program (same split and frequency) with the emphasis applied.
        if (updates.targetFocus !== undefined && updates.targetFocus !== (prev.profile.metrics.targetFocus ?? 'balanced')) {
          return applyProgramToState(prev, prev.workoutPlan.splitType, prev.workoutPlan.daysPerWeek, updates);
        }

        return {
          ...prev,
          profile: { ...prev.profile, metrics: updatedMetrics },
          nutritionPlan: newNutritionPlan,
        };
      };
      const next = compute(current);
      return followProfileSteps(current, next);
    });
  }

  /** Replaces the entire app state with an imported backup, running it through the same normalization boot-time data goes through. */
  async function handleImportAppState(data: AppState): Promise<void> {
    if (!userId) return;
    const restored = sanitizeAppState(data);
    if (!restored) throw new Error('Backup data is not a valid app state');
    // Persist before touching React state, so a storage failure (e.g. quota) rejects here
    // and leaves the user's existing data fully intact instead of half-restored.
    await storageService.saveAppState(userId, restored);
    setAppState(restored);
  }

  /** Regenerates the workout plan and nutrition targets to match a new weekly training frequency. */

  /** Stores the user's pick from the weekly rebalance modal. Everything is scoped to the current week and lapses on its own after it. */
  function handleApplyRebalance(choice: RebalanceChoice) {
    setAppState((prev) => {
      if (!prev) return prev;
      const today = todayIso();
      const current = getActiveAdjustment(prev.weeklyBalance, today) ?? { weekStart: getWeekStart(today) };
      const next = { ...current };
      if (choice.kind === 'taper') next.calorie = { reductionKcal: choice.reductionKcal, fromDate: choice.fromDate };
      if (choice.kind === 'steps') next.steps = { boost: choice.boost, days: choice.days, fromDate: choice.fromDate, toDate: choice.toDate };
      return { ...prev, weeklyBalance: next };
    });
  }

  function handleSaveCustomPlan(plan: WorkoutPlan) {
    setAppState((prev) => (prev ? applyCustomPlanToState(prev, plan) : prev));
  }

  function handleApplyProgram(splitType: WorkoutSplitType, daysPerWeek: TrainingDaysPerWeek) {
    setAppState((prev) => (prev ? applyProgramToState(prev, splitType, daysPerWeek) : prev));
  }

  if (isBooting) {
    return <BootScreen />;
  }

  if (!userId) {
    return (
      <>
        <UpdatePrompt />
        <Auth onAuthenticated={handleAuthenticated} />
        {isWelcomeGuideOpen && (
          <WelcomeGuide
            onClose={() => {
              markWelcomeGuideSeen();
              setIsWelcomeGuideOpen(false);
            }}
          />
        )}
        {isStandaloneWelcomeOpen && (
          <StandaloneRestorePrompt
            onRestored={(restoredUserId) => {
              markStandaloneWelcomeSeen();
              setIsStandaloneWelcomeOpen(false);
              void handleAuthenticated(restoredUserId);
            }}
            onStartFresh={() => {
              markStandaloneWelcomeSeen();
              setIsStandaloneWelcomeOpen(false);
            }}
          />
        )}
      </>
    );
  }

  if (!appState) {
    return (
      <>
        <UpdatePrompt />
        <Onboarding onComplete={handleOnboardingComplete} />
      </>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <UpdatePrompt />
      <Dashboard
        appState={appState}
        onToggleSet={toggleSet}
        onUpdateSetLog={updateSetLog}
        onSwapExercise={handleSwapExercise}
        onRevertExercise={handleRevertExercise}
        onSaveWeightLog={handleSaveWeightLog}
        onBulkImportWeightLogs={handleBulkImportWeightLogs}
        onDeleteWeightLog={handleDeleteWeightLog}
        onAddPhoto={handleAddPhoto}
        onDeletePhoto={handleDeletePhoto}
        onUpdatePhoto={handleUpdatePhoto}
        onApplyCalorieAdjustment={handleApplyCalorieAdjustment}
        onQuickCompleteDay={handleQuickCompleteDay}
        onUndoCompleteDay={handleUndoCompleteDay}
        onSetSchedule={handleSetSchedule}
        onClearSchedule={handleClearSchedule}
        onAddFood={handleAddFood}
        onToggleFavorite={handleToggleFavorite}
        onSaveMeal={handleSaveMeal}
        onDeleteSavedMeal={handleDeleteSavedMeal}
        onDeleteFood={handleDeleteFood}
        onUpdateFood={handleUpdateFood}
        onSaveSteps={handleSaveSteps}
        onSaveStepGoal={handleSaveStepGoal}
        onSaveCircumferenceEntry={handleSaveCircumferenceEntry}
        onDeleteCircumferenceEntry={handleDeleteCircumferenceEntry}
        onSaveCircumferenceGoals={handleSaveCircumferenceGoals}
        onApplyProgram={handleApplyProgram}
        onSaveCustomPlan={handleSaveCustomPlan}
        onApplyRebalance={handleApplyRebalance}
        onUpdateProfileFull={handleUpdateProfileFull}
        onImportAppState={handleImportAppState}
        onReset={handleReset}
        onLogout={handleLogout}
      />
      <AICoachDrawer appState={appState} userId={userId} onAddFood={handleAddFood} />
    </PullToRefresh>
  );
}

/** Brief boot-time placeholder while the session/app state loads from storage. */
function BootScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-400 text-zinc-950">
        <Dumbbell className="h-6 w-6" strokeWidth={2.5} />
      </div>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-lime-400" />
      </div>
    </div>
  );
}
