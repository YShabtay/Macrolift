import type { Exercise, SetLog, SetProgressEntry } from '../types/fitness';

/** The most weight a set may log (kg) and the most reps - guards against typos like 1000. */
export const MAX_SET_WEIGHT_KG = 1000;
export const MAX_SET_REPS = 200;

/** Upper end of a prescribed rep range: "6-8" -> 8, "10-12 לכל רגל" -> 12. Null for timed holds ("30-45 שניות") or anything unparsable. */
export function parseRepsUpperBound(repsRange: string): number | null {
  if (repsRange.includes('שני')) return null; // seconds, not reps
  const numbers = repsRange.match(/\d+/g)?.map(Number);
  if (!numbers || numbers.length === 0) return null;
  return Math.max(...numbers);
}

/** Epley estimate of the heaviest single the set implies. Used only to compare sets with each other, so the formula's error cancels out. */
export function estimateOneRepMax(log: SetLog): number | null {
  if (!log.weightKg || log.weightKg <= 0 || !log.reps || log.reps <= 0) return null;
  return log.weightKg * (1 + log.reps / 30);
}

function hasNumbers(log: SetLog | undefined): log is SetLog {
  return !!log && (log.weightKg !== undefined || log.reps !== undefined);
}

export interface SessionLog {
  date: string;
  sets: SetLog[];
}

/** The most recent session before `before` in which this exercise has written-down sets. */
export function getLastSessionLog(progress: SetProgressEntry[], exerciseName: string, before: string): SessionLog | null {
  let best: SetProgressEntry | null = null;
  for (const entry of progress) {
    if (entry.exerciseName !== exerciseName || entry.date >= before || !entry.sets?.some(hasNumbers)) continue;
    if (!best || entry.date > best.date) best = entry;
  }
  return best ? { date: best.date, sets: best.sets ?? [] } : null;
}

/**
 * Double progression: once every prescribed set of the last session reached the top of the rep range (at the same or a higher
 * weight), suggest a small weight increase. Null when there's nothing to base it on or the lifter isn't there yet.
 */
export function suggestNextWeight(last: SessionLog | null, exercise: Pick<Exercise, 'repsRange' | 'sets' | 'equipment'>): number | null {
  if (!last) return null;
  const top = parseRepsUpperBound(exercise.repsRange);
  if (top === null) return null;
  const logged = last.sets.filter((s) => s.weightKg && s.weightKg > 0 && s.reps && s.reps > 0);
  if (logged.length < exercise.sets) return null;
  const weight = Math.max(...logged.map((s) => s.weightKg ?? 0));
  const allAtTop = logged.slice(0, exercise.sets).every((s) => (s.reps ?? 0) >= top && (s.weightKg ?? 0) >= weight);
  if (!allAtTop) return null;
  const step = exercise.equipment === 'dumbbell' || exercise.equipment === 'cable' ? 2 : 2.5;
  return Math.round((weight + step) * 100) / 100;
}

const toText = (n: number | undefined | null): string => (n === undefined || n === null ? '' : String(n));

export interface SetDefaults {
  /** Pre-filled weight / reps for the set about to be done, as input text ('' when there is nothing to base them on). */
  weight: string;
  reps: string;
  /** The suggested weight when the last session topped the rep range (null otherwise). */
  suggestion: number | null;
  /** True when the pre-filled weight is that suggestion. */
  usesSuggestion: boolean;
}

/**
 * What to pre-fill for the next set: the previous set done today, else what was lifted for that set last time; for the first set of an
 * exercise whose rep range was topped last time, the suggested heavier weight with the bottom of the rep range.
 */
export function getSetDefaults(
  exercise: Pick<Exercise, 'repsRange' | 'sets' | 'equipment'>,
  entry: SetProgressEntry | undefined,
  lastSession: SessionLog | null,
  currentIndex: number,
): SetDefaults {
  const suggestion = suggestNextWeight(lastSession, exercise);
  const lowerBound = Number(exercise.repsRange.match(/\d+/)?.[0]);
  const previousToday = currentIndex > 0 ? entry?.sets?.[currentIndex - 1] : undefined;
  const lastTime = lastSession?.sets[currentIndex] ?? lastSession?.sets[lastSession.sets.length - 1];
  const usesSuggestion = currentIndex === 0 && suggestion !== null;
  return {
    weight: toText(previousToday?.weightKg ?? (usesSuggestion ? suggestion : lastTime?.weightKg)),
    reps: toText(previousToday?.reps ?? (usesSuggestion && Number.isFinite(lowerBound) ? lowerBound : lastTime?.reps)),
    suggestion,
    usesSuggestion,
  };
}

/** True when `log` beats every earlier logged set of this exercise (before `date`) on estimated 1RM - and there was an earlier set to beat. */
export function isPersonalRecord(progress: SetProgressEntry[], exerciseName: string, date: string, log: SetLog): boolean {
  const value = estimateOneRepMax(log);
  if (value === null) return false;
  let best: number | null = null;
  for (const entry of progress) {
    if (entry.exerciseName !== exerciseName || entry.date >= date) continue;
    for (const set of entry.sets ?? []) {
      const e = estimateOneRepMax(set);
      if (e !== null && (best === null || e > best)) best = e;
    }
  }
  return best !== null && value > best + 0.01;
}

export interface ToggleSetParams {
  dayId: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  /** Zero-based index of the set button that was tapped. */
  setIndex: number;
  /** What to record for the set(s) this tap completes. */
  log?: SetLog;
}

const sameEntry = (p: SetProgressEntry, dayId: string, exerciseId: string, date: string) =>
  p.dayId === dayId && p.exerciseId === exerciseId && p.date === date;

/**
 * Applies a tap on set button `setIndex`: tapping the last completed set un-completes it, anything else completes every set up to it.
 * Newly completed sets get `log`; un-completed sets lose theirs; sets that stay completed keep what was written down.
 */
export function toggleSetEntry(progress: SetProgressEntry[], params: ToggleSetParams): SetProgressEntry[] {
  const { dayId, exerciseId, exerciseName, date, setIndex, log } = params;
  const existing = progress.find((p) => sameEntry(p, dayId, exerciseId, date));
  const current = existing?.completedSets ?? 0;
  const next = current === setIndex + 1 ? setIndex : setIndex + 1;

  const sets: SetLog[] = [];
  for (let i = 0; i < next; i++) {
    const kept = i < current ? existing?.sets?.[i] : undefined;
    sets.push(kept ?? (hasNumbers(log) ? { ...log } : {}));
  }
  const entry: SetProgressEntry = { dayId, exerciseId, date, completedSets: next, exerciseName, sets };
  return [...progress.filter((p) => !sameEntry(p, dayId, exerciseId, date)), entry];
}

/** Rewrites the weight / reps of one already completed set. Does nothing when that set isn't completed. */
export function updateSetLogEntry(
  progress: SetProgressEntry[],
  params: { dayId: string; exerciseId: string; exerciseName: string; date: string; setIndex: number; log: SetLog },
): SetProgressEntry[] {
  const { dayId, exerciseId, exerciseName, date, setIndex, log } = params;
  const existing = progress.find((p) => sameEntry(p, dayId, exerciseId, date));
  if (!existing || setIndex >= existing.completedSets) return progress;
  const sets = Array.from({ length: existing.completedSets }, (_, i) => (i === setIndex ? { ...log } : (existing.sets?.[i] ?? {})));
  return progress.map((p) => (p === existing ? { ...existing, exerciseName, sets } : p));
}

/** Total weight x reps lifted in a session's logged sets (kg). */
export function sessionVolumeKg(sets: SetLog[] | undefined): number {
  return Math.round((sets ?? []).reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0));
}
