import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Minus, Play, Plus, SkipForward, Undo2, X } from 'lucide-react';
import type { DayWorkout, Equipment, Exercise, SetLog, SetProgressEntry } from '../types/fitness';
import { useRestTimer } from '../context/restTimerContext';
import { parseDecimal } from '../utils/decimalInput';
import { BAR_KG, getPlatesPerSide } from '../utils/plates';
import { getLastSessionLog, getSetDefaults, MAX_SET_REPS, MAX_SET_WEIGHT_KG } from '../utils/setLogs';
import { getDefaultRestSeconds } from '../utils/workoutStats';
import DecimalInput from './DecimalInput';

interface WorkoutModeProps {
  day: DayWorkout;
  progress: SetProgressEntry[];
  date: string;
  /** Ticks the next set of an exercise with these numbers (starts the rest timer, checks for a personal record). */
  onCompleteSet: (exercise: Exercise, setIndex: number, log: SetLog) => void;
  /** Un-ticks the last completed set of an exercise. */
  onUndoSet: (exercise: Exercise, completedSets: number) => void;
  onOpenVideo: (exercise: Exercise) => void;
  onClose: () => void;
}

const formatClock = (totalSeconds: number) => `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;

/** Smallest sensible weight change per tap: plates on a bar or machine move in 2.5 kg, dumbbells and bodyweight work in 1 kg. */
function weightStep(equipment: Equipment): number {
  return equipment === 'barbell' || equipment === 'machine' || equipment === 'cable' ? 2.5 : 1;
}

const clampWeight = (n: number) => Math.min(Math.max(Math.round(n * 100) / 100, 0), MAX_SET_WEIGHT_KG);

/**
 * Full-screen, one-exercise-at-a-time workout view for use between sets: big targets, weight and reps pre-filled and adjustable with + / -,
 * one large "set done" button that also starts the rest timer. The ordinary workout screen stays available and in sync (same data).
 */
export default function WorkoutMode({ day, progress, date, onCompleteSet, onUndoSet, onOpenVideo, onClose }: WorkoutModeProps) {
  const rest = useRestTimer();
  const entryFor = (exercise: Exercise) => progress.find((p) => p.dayId === day.id && p.exerciseId === exercise.id && p.date === date);
  const completedFor = (exercise: Exercise) => entryFor(exercise)?.completedSets ?? 0;

  const firstOpen = day.exercises.findIndex((e) => completedFor(e) < e.sets);
  const [index, setIndex] = useState(Math.max(firstOpen, 0));
  const exercise = day.exercises[Math.min(index, day.exercises.length - 1)];

  const totalSets = day.exercises.reduce((sum, e) => sum + e.sets, 0);
  const doneSets = day.exercises.reduce((sum, e) => sum + Math.min(completedFor(e), e.sets), 0);
  const isWorkoutDone = totalSets > 0 && doneSets >= totalSets;

  const entry = entryFor(exercise);
  const completed = entry?.completedSets ?? 0;
  const currentIndex = Math.min(completed, exercise.sets - 1);
  const isExerciseDone = completed >= exercise.sets;
  const lastSession = getLastSessionLog(progress, exercise.name, date);
  const defaults = getSetDefaults(exercise, entry, lastSession, currentIndex);

  const draftKey = `${exercise.id}:${currentIndex}`;
  const [draft, setDraft] = useState<{ key: string; weight: string; reps: string } | null>(null);
  const values = draft && draft.key === draftKey ? draft : { key: draftKey, weight: defaults.weight, reps: defaults.reps };

  const weight = parseDecimal(values.weight);
  const reps = parseDecimal(values.reps);
  const step = weightStep(exercise.equipment);

  const adjustWeight = (delta: number) => setDraft({ ...values, weight: String(clampWeight((weight ?? 0) + delta)) });
  const adjustReps = (delta: number) => setDraft({ ...values, reps: String(Math.min(Math.max(Math.round((reps ?? 0) + delta), 0), MAX_SET_REPS)) });

  function completeSet() {
    onCompleteSet(exercise, completed, {
      ...(weight !== null ? { weightKg: Math.min(weight, MAX_SET_WEIGHT_KG) } : {}),
      ...(reps !== null ? { reps: Math.min(Math.round(reps), MAX_SET_REPS) } : {}),
    });
  }

  const isResting = rest.status === 'running' || rest.status === 'paused';
  const plates = exercise.equipment === 'barbell' && weight !== null && weight > BAR_KG ? getPlatesPerSide(weight) : null;
  const nextIndex = index + 1 < day.exercises.length ? index + 1 : null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="מצב אימון" dir="rtl" className="fixed inset-0 z-[68] flex flex-col bg-zinc-50 dark:bg-zinc-950 animate-fade-in">
      <header className="px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} aria-label="יציאה ממצב אימון" className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-extrabold text-zinc-900 dark:text-zinc-100">{day.dayLabel}</p>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              תרגיל {index + 1} מתוך {day.exercises.length} &bull; {doneSets}/{totalSets} סטים
            </p>
          </div>
          <span className="w-10" />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-lime-400 transition-all duration-300" style={{ width: totalSets > 0 ? `${(doneSets / totalSets) * 100}%` : '0%' }} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-4">
        {isWorkoutDone && (
          <div className="mb-4 rounded-2xl border border-lime-400/50 bg-lime-400/10 p-4 text-center">
            <p className="text-xl font-extrabold text-lime-700 dark:text-lime-300">האימון הושלם! 🎉</p>
            <button type="button" onClick={onClose} className="btn-primary mt-3 w-full">
              סיום ויציאה
            </button>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold leading-tight text-zinc-900 dark:text-zinc-100">{exercise.name}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {exercise.sets} סטים &times; {exercise.repsRange} &bull; מנוחה {getDefaultRestSeconds(exercise)} שנ׳
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenVideo(exercise)}
            aria-label={`הדגמת וידאו: ${exercise.name}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lime-400 text-zinc-950 shadow-glow active:scale-95"
          >
            <Play className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="סטים">
          {Array.from({ length: exercise.sets }).map((_, i) => (
            <span
              key={i}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-extrabold ${
                i < completed
                  ? 'border-lime-400 bg-lime-400 text-zinc-950'
                  : i === currentIndex && !isExerciseDone
                    ? 'border-lime-400 text-lime-700 dark:text-lime-400'
                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-500'
              }`}
            >
              {i < completed ? <Check className="h-4 w-4" /> : i + 1}
            </span>
          ))}
        </div>

        {isResting && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-sky-400/40 bg-sky-400/10 p-4">
            <div>
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">מנוחה</p>
              <p className="text-4xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100" aria-live="off">
                {formatClock(rest.remainingSec)}
              </p>
            </div>
            <button type="button" onClick={rest.cancel} className="btn-secondary px-4 py-2.5 text-sm">
              <SkipForward className="h-4 w-4" />
              דלג על המנוחה
            </button>
          </div>
        )}
        {rest.status === 'finished' && (
          <p className="mt-4 rounded-2xl border border-lime-400/50 bg-lime-400/10 p-3 text-center text-sm font-extrabold text-lime-700 dark:text-lime-300">המנוחה נגמרה, לסט הבא 💪</p>
        )}

        {!isExerciseDone ? (
          <section className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 p-4">
            <p className="mb-3 text-sm font-bold text-zinc-800 dark:text-zinc-200">סט {currentIndex + 1}</p>

            <Stepper
              label="משקל (ק״ג)"
              value={values.weight}
              onChange={(text) => setDraft({ ...values, weight: text })}
              onMinus={() => adjustWeight(-step)}
              onPlus={() => adjustWeight(step)}
              minusLabel={`הפחת ${step} ק״ג`}
              plusLabel={`הוסף ${step} ק״ג`}
              inputLabel={`משקל בק״ג - ${exercise.name}`}
            />
            <div className="h-3" />
            <Stepper
              label="חזרות"
              value={values.reps}
              onChange={(text) => setDraft({ ...values, reps: text })}
              onMinus={() => adjustReps(-1)}
              onPlus={() => adjustReps(1)}
              minusLabel="הפחת חזרה"
              plusLabel="הוסף חזרה"
              inputLabel={`חזרות - ${exercise.name}`}
            />

            {lastSession && (
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                בפעם הקודמת:{' '}
                <span className="font-bold tabular-nums" dir="ltr">
                  {lastSession.sets
                    .filter((s) => s.weightKg !== undefined || s.reps !== undefined)
                    .map((s) => `${s.weightKg ?? '-'}×${s.reps ?? '-'}`)
                    .join('  ·  ')}
                </span>
              </p>
            )}
            {defaults.usesSuggestion && defaults.suggestion !== null && (
              <p className="mt-1 text-xs font-bold text-lime-700 dark:text-lime-400">הגעת לשיא הטווח בכל הסטים בפעם הקודמת - הצעה: {defaults.suggestion} ק״ג</p>
            )}
            {plates && (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                לוחיות לכל צד:{' '}
                <span className="font-bold tabular-nums text-zinc-800 dark:text-zinc-200" dir="ltr">
                  {plates.perSide.length > 0 ? plates.perSide.join(' + ') : 'מוט ריק'}
                </span>
              </p>
            )}

            <button type="button" onClick={completeSet} className="btn-primary mt-4 w-full py-4 text-lg">
              <Check className="h-5 w-5" />
              סיימתי סט {currentIndex + 1}
            </button>
          </section>
        ) : (
          <section className="mt-4 rounded-2xl border border-lime-400/40 bg-lime-400/10 p-4 text-center">
            <p className="text-lg font-extrabold text-lime-700 dark:text-lime-300">התרגיל הושלם ✅</p>
            {nextIndex !== null && (
              <button type="button" onClick={() => setIndex(nextIndex)} className="btn-primary mt-3 w-full py-3.5">
                לתרגיל הבא: {day.exercises[nextIndex].name}
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </section>
        )}

        {completed > 0 && (
          <button type="button" onClick={() => onUndoSet(exercise, completed)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-zinc-600 underline underline-offset-2 dark:text-zinc-400">
            <Undo2 className="h-3.5 w-3.5" />
            ביטול הסט האחרון
          </button>
        )}
      </main>

      <footer className="flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <button type="button" onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={index === 0} className="btn-secondary px-4 py-3 disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
          הקודם
        </button>
        <div className="flex flex-1 justify-center gap-1.5" aria-hidden="true">
          {day.exercises.map((e, i) => (
            <span
              key={e.id}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-lime-400' : completedFor(e) >= e.sets ? 'w-2 bg-lime-400/60' : 'w-2 bg-zinc-300 dark:bg-zinc-700'}`}
            />
          ))}
        </div>
        <button type="button" onClick={() => nextIndex !== null && setIndex(nextIndex)} disabled={nextIndex === null} className="btn-secondary px-4 py-3 disabled:opacity-30">
          הבא
          <ChevronLeft className="h-4 w-4" />
        </button>
      </footer>
    </div>,
    document.body,
  );
}

function Stepper({
  label,
  value,
  onChange,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
  inputLabel,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
  inputLabel: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">{label}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onMinus} aria-label={minusLabel} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 active:scale-95">
          <Minus className="h-6 w-6" />
        </button>
        <DecimalInput
          value={value}
          onValueChange={onChange}
          placeholder="0"
          aria-label={inputLabel}
          className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-lime-400/50 bg-white dark:bg-zinc-900 text-center text-3xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
        />
        <button type="button" onClick={onPlus} aria-label={plusLabel} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 active:scale-95">
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
