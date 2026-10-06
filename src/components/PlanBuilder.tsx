import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, Dumbbell, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import type { DayWorkout, Equipment, Exercise, MuscleGroup, WorkoutPlan } from '../types/fitness';
import { createPlanExercise, getExerciseLibrary, type LibraryExercise } from '../data/workoutTemplates';
import { MUSCLE_LABELS } from '../utils/planVolume';
import WeeklyVolume from './WeeklyVolume';

const MIN_SESSIONS = 2;
const MAX_SESSIONS = 6;
const MAX_EXERCISES_PER_SESSION = 14;
const REST_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180, 240];

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'מוט',
  dumbbell: 'משקולות',
  machine: 'מכונה',
  cable: 'כבלים',
  bodyweight: 'משקל גוף',
  kettlebell: 'קטלבל',
  band: 'גומיה',
};

const PICKER_MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'];

interface PlanBuilderProps {
  /** The plan to start from (edited on a copy; nothing changes until "save"). */
  plan: WorkoutPlan;
  onSave: (plan: WorkoutPlan) => void;
  onClose: () => void;
}

function cloneDays(days: DayWorkout[]): DayWorkout[] {
  return days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));
}

function makeDay(index: number): DayWorkout {
  return { id: `cd-${crypto.randomUUID()}`, dayLabel: `אימון ${String.fromCharCode(65 + index)}`, focus: '', exercises: [] };
}

/**
 * Build your own program: name it, add 2-6 sessions, and fill each from the exercise library (or add your own exercise) with sets, reps
 * and rest. Starts from the current plan so a ready-made program can be adjusted instead of rebuilt. A live chart shows the weekly sets per muscle.
 */
export default function PlanBuilder({ plan, onSave, onClose }: PlanBuilderProps) {
  const [title, setTitle] = useState(plan.isCustom ? plan.title : 'התוכנית שלי');
  const [days, setDays] = useState<DayWorkout[]>(() => cloneDays(plan.days));
  const [selectedId, setSelectedId] = useState(plan.days[0]?.id ?? '');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);

  const selected = days.find((d) => d.id === selectedId) ?? days[0];

  function updateDay(id: string, change: (day: DayWorkout) => DayWorkout) {
    setDays((prev) => prev.map((d) => (d.id === id ? change(d) : d)));
  }

  function updateExercise(dayId: string, exerciseId: string, change: Partial<Exercise>) {
    updateDay(dayId, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === exerciseId ? { ...e, ...change } : e)) }));
  }

  function moveExercise(dayId: string, index: number, direction: -1 | 1) {
    updateDay(dayId, (d) => {
      const target = index + direction;
      if (target < 0 || target >= d.exercises.length) return d;
      const exercises = [...d.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...d, exercises };
    });
  }

  function addSession() {
    if (days.length >= MAX_SESSIONS) return;
    const day = makeDay(days.length);
    setDays((prev) => [...prev, day]);
    setSelectedId(day.id);
  }

  function removeSession(id: string) {
    if (days.length <= MIN_SESSIONS) return;
    const remaining = days.filter((d) => d.id !== id);
    setDays(remaining);
    if (selectedId === id) setSelectedId(remaining[0].id);
  }

  const emptySessions = days.filter((d) => d.exercises.length === 0);
  const unnamedSessions = days.filter((d) => !d.dayLabel.trim());
  const canSave = title.trim().length > 0 && days.length >= MIN_SESSIONS && emptySessions.length === 0 && unnamedSessions.length === 0;

  function handleSave() {
    if (!canSave) return;
    onSave({
      id: `custom-${crypto.randomUUID()}`,
      splitType: plan.splitType,
      daysPerWeek: Math.min(Math.max(days.length, 2), 6) as WorkoutPlan['daysPerWeek'],
      title: title.trim(),
      description: `תוכנית אישית עם ${days.length} אימונים בשבוע, שנבנתה על ידך.`,
      isCustom: true,
      days: days.map((d) => ({ ...d, dayLabel: d.dayLabel.trim(), focus: d.focus.trim() || d.dayLabel.trim() })),
    });
  }

  const draftPlan = useMemo(() => ({ days }), [days]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="בניית תוכנית אימון"
      dir="rtl"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/80 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
    >
      <div className="glass-card neon-border flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-b-none shadow-glow animate-slide-up sm:rounded-b-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-zinc-950">
              <Dumbbell className="h-5 w-5" />
            </span>
            <h3 className="truncate font-extrabold text-zinc-900 dark:text-zinc-100">בניית תוכנית אימון</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה ללא שמירה" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">שם התוכנית</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {days.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                aria-pressed={d.id === selected.id}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  d.id === selected.id
                    ? 'border-lime-400/60 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {d.dayLabel || 'ללא שם'}
                {d.exercises.length === 0 && <span className="mr-1 text-amber-500">•</span>}
              </button>
            ))}
            {days.length < MAX_SESSIONS && (
              <button
                type="button"
                onClick={addSession}
                className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-400 dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-lime-400"
              >
                <Plus className="h-3.5 w-3.5" />
                אימון
              </button>
            )}
          </div>

          {selected && (
            <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-600 dark:text-zinc-500">שם האימון</label>
                  <input
                    value={selected.dayLabel}
                    onChange={(e) => updateDay(selected.id, (d) => ({ ...d, dayLabel: e.target.value }))}
                    maxLength={30}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-600 dark:text-zinc-500">מיקוד (אופציונלי)</label>
                  <input
                    value={selected.focus}
                    onChange={(e) => updateDay(selected.id, (d) => ({ ...d, focus: e.target.value }))}
                    maxLength={40}
                    placeholder="למשל: חזה וכתפיים"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-lime-400"
                  />
                </div>
              </div>

              <ul className="mt-3 flex flex-col gap-2">
                {selected.exercises.map((exercise, index) => (
                  <li key={exercise.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{exercise.name}</p>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-500">
                          {MUSCLE_LABELS[exercise.muscleGroup]} &bull; {EQUIPMENT_LABELS[exercise.equipment]}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <IconButton label="הזז למעלה" disabled={index === 0} onClick={() => moveExercise(selected.id, index, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="הזז למטה" disabled={index === selected.exercises.length - 1} onClick={() => moveExercise(selected.id, index, 1)}>
                          <ArrowDown className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={`הסרת ${exercise.name}`}
                          danger
                          onClick={() => updateDay(selected.id, (d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== exercise.id) }))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 items-end gap-2">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold text-zinc-500">סטים</p>
                        <div className="flex items-center justify-between rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                          <button
                            type="button"
                            aria-label={`פחות סטים - ${exercise.name}`}
                            disabled={exercise.sets <= 1}
                            onClick={() => updateExercise(selected.id, exercise.id, { sets: exercise.sets - 1 })}
                            className="flex h-9 w-9 items-center justify-center text-zinc-600 disabled:opacity-30 dark:text-zinc-400"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-sm font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100">{exercise.sets}</span>
                          <button
                            type="button"
                            aria-label={`עוד סט - ${exercise.name}`}
                            disabled={exercise.sets >= 10}
                            onClick={() => updateExercise(selected.id, exercise.id, { sets: exercise.sets + 1 })}
                            className="flex h-9 w-9 items-center justify-center text-zinc-600 disabled:opacity-30 dark:text-zinc-400"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold text-zinc-500">חזרות</p>
                        <input
                          value={exercise.repsRange}
                          onChange={(e) => updateExercise(selected.id, exercise.id, { repsRange: e.target.value.slice(0, 20) })}
                          aria-label={`טווח חזרות - ${exercise.name}`}
                          dir="ltr"
                          className="h-9 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center text-sm font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold text-zinc-500">מנוחה</p>
                        <select
                          value={exercise.restSeconds}
                          onChange={(e) => updateExercise(selected.id, exercise.id, { restSeconds: Number(e.target.value) })}
                          aria-label={`זמן מנוחה - ${exercise.name}`}
                          className="h-9 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 text-center text-sm font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
                        >
                          {(REST_OPTIONS.includes(exercise.restSeconds) ? REST_OPTIONS : [...REST_OPTIONS, exercise.restSeconds].sort((a, b) => a - b)).map((s) => (
                            <option key={s} value={s}>
                              {s} שנ׳
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {selected.exercises.length === 0 && <p className="mt-3 text-center text-xs text-amber-700 dark:text-amber-400">עדיין אין תרגילים באימון הזה.</p>}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  disabled={selected.exercises.length >= MAX_EXERCISES_PER_SESSION}
                  className="btn-secondary px-4 py-2.5 text-sm disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  הוסף תרגיל
                </button>
                {days.length > MIN_SESSIONS && (
                  <button
                    type="button"
                    onClick={() => removeSession(selected.id)}
                    className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    מחק את האימון
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsVolumeOpen((v) => !v)}
              aria-expanded={isVolumeOpen}
              className="text-xs font-bold text-lime-700 underline underline-offset-2 dark:text-lime-400"
            >
              {isVolumeOpen ? 'הסתר' : 'הצג'} סטים שבועיים לכל שריר
            </button>
            {isVolumeOpen && <WeeklyVolume plan={draftPlan} className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3" />}
          </div>
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          {!canSave && (
            <p className="mb-2 text-center text-[11px] text-amber-700 dark:text-amber-400">
              {emptySessions.length > 0 ? `יש להוסיף תרגיל לכל אימון (חסר ב: ${emptySessions.map((d) => d.dayLabel || 'ללא שם').join(', ')})` : 'יש להזין שם לתוכנית ולכל אימון.'}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} disabled={!canSave} className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40">
              <Check className="h-4 w-4" />
              שמירת התוכנית
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              ביטול
            </button>
          </div>
        </div>
      </div>

      {isPickerOpen && selected && (
        <ExercisePicker
          existingNames={new Set(selected.exercises.map((e) => e.name))}
          onAdd={(exercise) => updateDay(selected.id, (d) => ({ ...d, exercises: [...d.exercises, exercise] }))}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </div>,
    document.body,
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-30 ${
        danger ? 'text-zinc-500 hover:bg-red-500/10 hover:text-red-500' : 'text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Exercise picker
// ---------------------------------------------------------------------------

function ExercisePicker({ existingNames, onAdd, onClose }: { existingNames: Set<string>; onAdd: (exercise: Exercise) => void; onClose: () => void }) {
  const library = useMemo(() => getExerciseLibrary(), []);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('chest');
  const [customEquipment, setCustomEquipment] = useState<Equipment>('dumbbell');

  const normalized = query.trim().toLowerCase();
  const results = library.filter(
    (e) => (muscle === 'all' || e.muscleGroup === muscle) && (!normalized || e.name.toLowerCase().includes(normalized) || (e.nameEn ?? '').toLowerCase().includes(normalized)),
  );

  function add(item: LibraryExercise) {
    onAdd(createPlanExercise(item));
    setAdded((prev) => new Set(prev).add(item.name));
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    add({ name, muscleGroup: customMuscle, equipment: customEquipment });
    setCustomName('');
    setIsCustomOpen(false);
  }

  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-zinc-950/70 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="בחירת תרגיל"
        className="glass-card neon-border flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-b-none shadow-glow animate-slide-up sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-3">
          <h4 className="font-bold text-zinc-900 dark:text-zinc-100">הוספת תרגיל {added.size > 0 && <span className="text-xs font-semibold text-lime-600 dark:text-lime-400">(נוספו {added.size})</span>}</h4>
          <button type="button" onClick={onClose} className="text-xs font-bold text-lime-700 dark:text-lime-400">
            סיום
          </button>
        </div>

        <div className="p-3 pb-0">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש תרגיל..."
              aria-label="חיפוש תרגיל"
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2.5 pe-3 ps-9 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
              style={{ paddingRight: '2.25rem' }}
            />
          </div>
          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-2">
            {(['all', ...PICKER_MUSCLES] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMuscle(m)}
                aria-pressed={muscle === m}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                  muscle === m ? 'border-lime-400 bg-lime-400/15 text-lime-700 dark:text-lime-400' : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {m === 'all' ? 'הכול' : MUSCLE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto px-3 pb-3">
          {results.map((item) => {
            const isIn = existingNames.has(item.name) || added.has(item.name);
            return (
              <li key={item.name} className="flex items-center justify-between gap-2 border-b border-zinc-200/70 py-2 dark:border-zinc-800/70">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-500">
                    {MUSCLE_LABELS[item.muscleGroup]} &bull; {EQUIPMENT_LABELS[item.equipment]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => add(item)}
                  aria-label={`הוספת ${item.name}`}
                  className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                    isIn ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400' : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {isIn ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {isIn ? 'עוד אחד' : 'הוסף'}
                </button>
              </li>
            );
          })}
          {results.length === 0 && <li className="py-6 text-center text-sm text-zinc-600 dark:text-zinc-500">לא נמצא תרגיל. אפשר להוסיף תרגיל משלך למטה.</li>}
        </ul>

        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
          {isCustomOpen ? (
            <div className="flex flex-col gap-2">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={40}
                placeholder="שם התרגיל שלך"
                aria-label="שם התרגיל שלך"
                autoFocus
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={customMuscle}
                  onChange={(e) => setCustomMuscle(e.target.value as MuscleGroup)}
                  aria-label="קבוצת שריר"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  {PICKER_MUSCLES.map((m) => (
                    <option key={m} value={m}>
                      {MUSCLE_LABELS[m]}
                    </option>
                  ))}
                </select>
                <select
                  value={customEquipment}
                  onChange={(e) => setCustomEquipment(e.target.value as Equipment)}
                  aria-label="ציוד"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((eq) => (
                    <option key={eq} value={eq}>
                      {EQUIPMENT_LABELS[eq]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addCustom} disabled={!customName.trim()} className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">
                  הוספת התרגיל
                </button>
                <button type="button" onClick={() => setIsCustomOpen(false)} className="btn-secondary py-2 text-sm">
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setIsCustomOpen(true)} className="w-full text-center text-xs font-bold text-lime-700 underline underline-offset-2 dark:text-lime-400">
              לא מצאת? הוסף תרגיל משלך
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
