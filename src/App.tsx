import { useEffect, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import Auth from './components/Auth';
import { clearSession, getSessionUserId } from './utils/authStorage';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import AICoachDrawer from './components/AICoachDrawer';
import { todayIso } from './utils/weightCalculations';
import { storageService } from './services/storageService';
import type {
  AppState,
  BodyMeasurements,
  CircumferenceEntry,
  CircumferenceGoals,
  ExerciseAlternative,
  FoodEntry,
  ProgressPhoto,
  SetProgressEntry,
  StepLog,
  TrainingDaysPerWeek,
  UserMetrics,
  UserProfile,
  WeightLog,
  WorkoutScheduleEntry,
} from './types/fitness';
import type { NutritionPlan, WorkoutPlan } from './types/fitness';
import { calculateMacros, calculateNutritionPlan } from './utils/calculations';
import { getExerciseAlternatives, getWorkoutTemplate, suggestSplitType } from './data/workoutTemplates';
import { adaptWorkoutPlan } from './utils/workoutAdaptation';
import { buildSwappedExercise, revertSwappedExercise } from './utils/exerciseSwap';
import type { BulkWeightEntry } from './utils/bulkWeightParser';
import { requestPersistentStorage } from './utils/persistentStorage';
import UpdatePrompt from './components/UpdatePrompt';

/** Backfills fields added after a user's data was first saved, so components can assume they exist. */
function normalizeState(state: AppState): AppState {
  return {
    ...state,
    weightLogs: state.weightLogs ?? [],
    progressPhotos: state.progressPhotos ?? [],
    schedule: state.schedule ?? [],
    foodLog: state.foodLog ?? [],
    stepLogs: state.stepLogs ?? [],
    circumferenceLogs: state.circumferenceLogs ?? [],
    circumferenceGoals: state.circumferenceGoals ?? {},
    workoutPlan: {
      ...state.workoutPlan,
      days: state.workoutPlan.days.map((day) => ({
        ...day,
        exercises: day.exercises.map((exercise) => ({
          ...exercise,
          alternatives: exercise.alternatives ?? getExerciseAlternatives(exercise.name),
        })),
      })),
    },
  };
}

async function loadState(userId: string): Promise<AppState | null> {
  const state = await storageService.getAppState(userId);
  return state ? normalizeState(state) : null;
}

export default function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState | null>(null);

  useEffect(() => {
    (async () => {
      const sessionUserId = await getSessionUserId();
      setUserId(sessionUserId);
      if (sessionUserId) setAppState(await loadState(sessionUserId));
      setIsBooting(false);
    })();
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

  function toggleSet(dayId: string, exerciseId: string, setIndex: number) {
    setAppState((prev) => {
      if (!prev) return prev;
      const date = todayIso();
      const existing = prev.progress.find(
        (p) => p.dayId === dayId && p.exerciseId === exerciseId && p.date === date,
      );
      const currentCount = existing?.completedSets ?? 0;
      const nextCount = currentCount === setIndex + 1 ? setIndex : setIndex + 1;

      const withoutEntry = prev.progress.filter(
        (p) => !(p.dayId === dayId && p.exerciseId === exerciseId && p.date === date),
      );

      const newEntry: SetProgressEntry = { dayId, exerciseId, date, completedSets: nextCount };
      return { ...prev, progress: [...withoutEntry, newEntry] };
    });
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
      const macros = calculateMacros(targetCalories, prev.profile.metrics.weightKg, prev.profile.metrics.goal);
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
      return { ...prev, progress: [...withoutDay, ...completedEntries] };
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
          }
        : prev,
    );
  }

  /** Reverses handleQuickCompleteDay - removes the completed-set records for one day/date, undoing "מסומן כהושלם". */
  function handleUndoCompleteDay(dayId: string, date: string = todayIso()) {
    setAppState((prev) =>
      prev ? { ...prev, progress: prev.progress.filter((p) => !(p.dayId === dayId && p.date === date)) } : prev,
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
      const withoutDate = prev.stepLogs.filter((s) => s.date !== date);
      const entry: StepLog = { date, steps };
      return { ...prev, stepLogs: [...withoutDate, entry] };
    });
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
    setAppState((prev) => {
      if (!prev) return prev;
      const updatedMetrics = { ...prev.profile.metrics, ...updates };
      const newNutritionPlan = calculateNutritionPlan(updatedMetrics);

      if (updates.trainingDaysPerWeek && updates.trainingDaysPerWeek !== prev.profile.metrics.trainingDaysPerWeek) {
        const split = suggestSplitType(updates.trainingDaysPerWeek);
        const baseTemplate = getWorkoutTemplate(split, updates.trainingDaysPerWeek);
        const { plan: newWorkoutPlan } = adaptWorkoutPlan(baseTemplate, updatedMetrics.experience);
        return {
          ...prev,
          profile: { ...prev.profile, metrics: updatedMetrics },
          workoutPlan: newWorkoutPlan,
          nutritionPlan: newNutritionPlan,
        };
      }

      return {
        ...prev,
        profile: { ...prev.profile, metrics: updatedMetrics },
        nutritionPlan: newNutritionPlan,
      };
    });
  }

  /** Replaces the entire app state with an imported backup, running it through the same normalization boot-time data goes through. */
  function handleImportAppState(data: AppState) {
    setAppState(normalizeState(data));
  }

  /** Regenerates the workout plan and nutrition targets to match a new weekly training frequency. */

  function handleChangeTrainingDays(newDays: TrainingDaysPerWeek) {
    setAppState((prev) => {
      if (!prev) return prev;
      const updatedMetrics = { ...prev.profile.metrics, trainingDaysPerWeek: newDays };
      const split = suggestSplitType(newDays);
      const baseTemplate = getWorkoutTemplate(split, newDays);
      const { plan: newWorkoutPlan } = adaptWorkoutPlan(baseTemplate, updatedMetrics.experience);
      const newNutritionPlan = calculateNutritionPlan(updatedMetrics);
      return {
        ...prev,
        profile: { ...prev.profile, metrics: updatedMetrics },
        workoutPlan: newWorkoutPlan,
        nutritionPlan: newNutritionPlan,
      };
    });
  }

  if (isBooting) {
    return <BootScreen />;
  }

  if (!userId) {
    return (
      <>
        <UpdatePrompt />
        <Auth onAuthenticated={handleAuthenticated} />
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
    <>
      <UpdatePrompt />
      <Dashboard
        appState={appState}
        onToggleSet={toggleSet}
        onSwapExercise={handleSwapExercise}
        onRevertExercise={handleRevertExercise}
        onSaveWeightLog={handleSaveWeightLog}
        onBulkImportWeightLogs={handleBulkImportWeightLogs}
        onDeleteWeightLog={handleDeleteWeightLog}
        onAddPhoto={handleAddPhoto}
        onDeletePhoto={handleDeletePhoto}
        onApplyCalorieAdjustment={handleApplyCalorieAdjustment}
        onQuickCompleteDay={handleQuickCompleteDay}
        onUndoCompleteDay={handleUndoCompleteDay}
        onSetSchedule={handleSetSchedule}
        onClearSchedule={handleClearSchedule}
        onAddFood={handleAddFood}
        onDeleteFood={handleDeleteFood}
        onUpdateFood={handleUpdateFood}
        onSaveSteps={handleSaveSteps}
        onSaveCircumferenceEntry={handleSaveCircumferenceEntry}
        onDeleteCircumferenceEntry={handleDeleteCircumferenceEntry}
        onSaveCircumferenceGoals={handleSaveCircumferenceGoals}
        onChangeTrainingDays={handleChangeTrainingDays}
        onUpdateProfileFull={handleUpdateProfileFull}
        onImportAppState={handleImportAppState}
        onReset={handleReset}
        onLogout={handleLogout}
      />
      <AICoachDrawer appState={appState} userId={userId} onAddFood={handleAddFood} />
    </>
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
