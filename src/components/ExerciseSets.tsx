import { useState } from 'react';
import { Pencil, Trophy } from 'lucide-react';
import type { Exercise, SetLog, SetProgressEntry } from '../types/fitness';
import DecimalInput from './DecimalInput';
import { parseDecimal } from '../utils/decimalInput';
import { BAR_KG, buildWarmupSets, getPlatesPerSide } from '../utils/plates';
import { getSetDefaults, MAX_SET_REPS, MAX_SET_WEIGHT_KG, parseRepsUpperBound, type SessionLog } from '../utils/setLogs';

interface ExerciseSetsProps {
  exercise: Exercise;
  /** Today's progress for this exercise, if any set was ticked. */
  entry: SetProgressEntry | undefined;
  /** The previous session in which this exercise has written-down sets. */
  lastSession: SessionLog | null;
  /** Called with the tapped set button and the weight / reps typed for it (omitted when un-ticking). */
  onToggle: (setIndex: number, log: SetLog | undefined) => void;
  /** Rewrites the numbers of a set that is already ticked. */
  onUpdateLog: (setIndex: number, log: SetLog) => void;
}

const parseWeight = (text: string): number | undefined => {
  const n = parseDecimal(text);
  return n === null ? undefined : Math.min(n, MAX_SET_WEIGHT_KG);
};
const parseReps = (text: string): number | undefined => {
  const n = parseDecimal(text);
  return n === null ? undefined : Math.min(Math.round(n), MAX_SET_REPS);
};

const toText = (n: number | undefined): string => (n === undefined ? '' : String(n));

/** "60×8" / "60 ק״ג" / "8 חז׳" - what a logged set looks like in a summary. */
function formatSet(set: SetLog): string {
  if (set.weightKg !== undefined && set.reps !== undefined) return `${set.weightKg}×${set.reps}`;
  if (set.weightKg !== undefined) return `${set.weightKg} ק״ג`;
  if (set.reps !== undefined) return `${set.reps} חז׳`;
  return '-';
}

/**
 * The set buttons of one exercise plus a one-line logger for the NEXT set: weight and reps, pre-filled from what was lifted last time
 * (or from the previous set today). Ticking the set stores the numbers. Done sets can be corrected afterwards.
 */
export default function ExerciseSets({ exercise, entry, lastSession, onToggle, onUpdateLog }: ExerciseSetsProps) {
  const completed = entry?.completedSets ?? 0;
  const currentIndex = Math.min(completed, exercise.sets - 1);
  const isAllDone = completed >= exercise.sets;
  const [isEditing, setIsEditing] = useState(false);
  const [isWarmupOpen, setIsWarmupOpen] = useState(false);

  // Defaults for the set about to be done. A draft the user is typing is kept only while it belongs to this set.
  const draftKey = `${exercise.id}:${currentIndex}`;
  const { suggestion, usesSuggestion: useSuggestion, ...defaults } = getSetDefaults(exercise, entry, lastSession, currentIndex);
  const [draft, setDraft] = useState<{ key: string; weight: string; reps: string } | null>(null);
  const values = draft && draft.key === draftKey ? draft : { key: draftKey, ...defaults };

  const currentLog: SetLog = { weightKg: parseWeight(values.weight), reps: parseReps(values.reps) };
  const isBarbell = exercise.equipment === 'barbell';
  const plates = getPlatesPerSide(currentLog.weightKg ?? 0);
  const warmups = isBarbell && currentIndex === 0 ? buildWarmupSets(currentLog.weightKg ?? 0) : [];
  const doneSets = (entry?.sets ?? []).slice(0, completed);
  const hasNumbersLogged = doneSets.some((s) => s.weightKg !== undefined || s.reps !== undefined);
  const topReps = parseRepsUpperBound(exercise.repsRange);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: exercise.sets }).map((_, i) => {
          const setDone = i < completed;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onToggle(i, i >= completed ? currentLog : undefined)}
              aria-label={`סט ${i + 1} מתוך ${exercise.sets} - ${exercise.name}`}
              aria-pressed={setDone}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold transition active:scale-90 ${
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

      {!isAllDone && (
        <div className="rounded-lg bg-zinc-100/70 dark:bg-zinc-900/70 p-2.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">סט {currentIndex + 1}</span>
            <DecimalInput
              value={values.weight}
              onValueChange={(weight) => setDraft({ ...values, weight })}
              placeholder="0"
              aria-label={`משקל בק״ג לסט ${currentIndex + 1} - ${exercise.name}`}
              className="h-9 w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
            />
            <span className="text-[11px] text-zinc-500">ק״ג ×</span>
            <DecimalInput
              value={values.reps}
              onValueChange={(reps) => setDraft({ ...values, reps })}
              placeholder="0"
              aria-label={`חזרות לסט ${currentIndex + 1} - ${exercise.name}`}
              className="h-9 w-14 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
            />
            <span className="text-[11px] text-zinc-500">חזרות</span>
          </div>
          {isBarbell && currentLog.weightKg !== undefined && currentLog.weightKg > BAR_KG && (
            <div className="mt-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
              <p>
                <span className="font-semibold">לוחיות לכל צד:</span>{' '}
                <span className="font-bold tabular-nums text-zinc-800 dark:text-zinc-200" dir="ltr">
                  {plates.perSide.length > 0 ? plates.perSide.join(' + ') : 'מוט ריק'}
                </span>
                {plates.leftoverKg > 0 && <span className="text-amber-600 dark:text-amber-400"> (חסרים {plates.leftoverKg} ק״ג מדויקים)</span>}
                <span className="text-zinc-500"> · מוט {BAR_KG} ק״ג</span>
              </p>
              {warmups.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsWarmupOpen((v) => !v)}
                    aria-expanded={isWarmupOpen}
                    className="mt-1 font-semibold text-lime-700 underline underline-offset-2 dark:text-lime-400"
                  >
                    {isWarmupOpen ? 'הסתר חימום' : 'הצע סטי חימום'}
                  </button>
                  {isWarmupOpen && (
                    <ol className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-semibold tabular-nums text-zinc-800 dark:text-zinc-200" dir="ltr">
                      {warmups.map((w) => (
                        <li key={`${w.weightKg}-${w.reps}`}>
                          {w.weightKg}×{w.reps}
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          )}
          {lastSession && (
            <p className="mt-1.5 text-[11px] text-zinc-600 dark:text-zinc-500">
              בפעם הקודמת: {lastSession.sets.filter((s) => s.weightKg !== undefined || s.reps !== undefined).map(formatSet).join(' · ')}
            </p>
          )}
          {useSuggestion && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-lime-700 dark:text-lime-400">
              <Trophy className="h-3 w-3" />
              הגעת לשיא הטווח{topReps ? ` (${topReps} חזרות)` : ''} בכל הסטים - הצעה: {suggestion} ק״ג
            </p>
          )}
        </div>
      )}

      {hasNumbersLogged && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold">היום:</span>
          <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200" dir="ltr">
            {doneSets.map(formatSet).join('  ·  ')}
          </span>
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            aria-expanded={isEditing}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-lime-700 hover:bg-lime-400/10 dark:text-lime-400"
          >
            <Pencil className="h-3 w-3" />
            {isEditing ? 'סגירה' : 'תיקון'}
          </button>
        </div>
      )}

      {isEditing && (
        <div className="flex flex-col gap-1.5">
          {doneSets.map((set, i) => (
            <EditSetRow key={i} index={i} set={set} onChange={(log) => onUpdateLog(i, log)} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One correctable set. It keeps the typed text itself (a half-typed "6." must stay "6."), and reports the parsed numbers upward as they change.
 */
function EditSetRow({ index, set, onChange }: { index: number; set: SetLog; onChange: (log: SetLog) => void }) {
  const [weight, setWeight] = useState(toText(set.weightKg));
  const [reps, setReps] = useState(toText(set.reps));

  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">סט {index + 1}</span>
      <DecimalInput
        value={weight}
        onValueChange={(text) => {
          setWeight(text);
          onChange({ weightKg: parseWeight(text), reps: parseReps(reps) });
        }}
        placeholder="0"
        aria-label={`תיקון משקל סט ${index + 1}`}
        className="h-9 w-16 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
      />
      <span className="text-[11px] text-zinc-500">ק״ג ×</span>
      <DecimalInput
        value={reps}
        onValueChange={(text) => {
          setReps(text);
          onChange({ weightKg: parseWeight(weight), reps: parseReps(text) });
        }}
        placeholder="0"
        aria-label={`תיקון חזרות סט ${index + 1}`}
        className="h-9 w-14 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
      />
      <span className="text-[11px] text-zinc-500">חזרות</span>
    </div>
  );
}
