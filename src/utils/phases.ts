import type { AppState, Goal, GoalPhase, ProgressPhoto, WeightLog } from '../types/fitness';
import { addDaysIso } from './dateMath';
import { buildWeeklySummaries } from './weightCalculations';

export const PHASE_LABELS: Record<Goal, string> = {
  lose_weight: 'חיטוב',
  gain_muscle: 'מסה',
  maintain: 'שימור',
  recomp: 'שיפור הרכב גוף',
};

type PhaseState = Pick<AppState, 'phases' | 'weightLogs' | 'profile'>;

const byStart = (a: GoalPhase, b: GoalPhase) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0);

/** The first day the app has data for: the earliest weigh-in, else the day the profile was made. */
function firstKnownDate(state: PhaseState, today: string): string {
  const firstWeighIn = state.weightLogs.reduce<string | null>((min, w) => (min === null || w.date < min ? w.date : min), null);
  return firstWeighIn ?? state.profile.createdAt?.slice(0, 10) ?? today;
}

/**
 * The periods to show, oldest first. Saved periods are used as they are; when there are none, one open period is derived (the current goal since the first
 * data). When the profile's goal differs from the open period's (a goal changed some way that was not tracked, such as a restored backup), the open period is
 * closed yesterday and a new one starts today - derived here, saved the next time the goal changes.
 */
export function getEffectivePhases(state: PhaseState, today: string): GoalPhase[] {
  const goal = state.profile.metrics.goal;
  const saved = [...(state.phases ?? [])].sort(byStart);
  if (saved.length === 0) return [{ id: 'derived-current', goal, startDate: firstKnownDate(state, today) }];
  const last = saved[saved.length - 1];
  if (last.endDate === undefined && last.goal !== goal) {
    if (last.startDate >= today) return [...saved.slice(0, -1), { ...last, goal }];
    return [...saved.slice(0, -1), { ...last, endDate: addDaysIso(today, -1) }, { id: `derived-${today}`, goal, startDate: today }];
  }
  return saved;
}

/** Closes the open period and opens a new one on `today` when the goal changed between two states; otherwise returns `next` untouched. */
export function trackGoalChange(prev: AppState, next: AppState, today: string): AppState {
  if (prev.profile.metrics.goal === next.profile.metrics.goal) return next;
  const phases = getEffectivePhases(prev, today);
  const last = phases[phases.length - 1];
  const newGoal = next.profile.metrics.goal;
  const kept = last.startDate >= today ? phases.slice(0, -1) : [...phases.slice(0, -1), { ...last, endDate: addDaysIso(today, -1) }];
  return { ...next, phases: [...kept, { id: `phase-${crypto.randomUUID()}`, goal: newGoal, startDate: today }] };
}

/** True when `date` falls inside the period (an open one runs to today). */
export function isInPhase(date: string, phase: GoalPhase, today: string): boolean {
  return date >= phase.startDate && date <= (phase.endDate ?? today);
}

export function filterLogsToPhase(logs: WeightLog[], phase: GoalPhase, today: string): WeightLog[] {
  return logs.filter((w) => isInPhase(w.date, phase, today));
}

/**
 * The photos for one period: the ones taken in it, plus the last photo from before it as the starting point (a bulk that begins where the cut ended
 * shows how that cut finished). `baselineId` names that earlier photo, when there is one.
 */
export function photosForPhase(photos: ProgressPhoto[], phase: GoalPhase, today: string): { photos: ProgressPhoto[]; baselineId: string | null } {
  const inside = photos.filter((p) => isInPhase(p.date, phase, today));
  const before = photos.filter((p) => p.date < phase.startDate).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return { photos: before ? [before, ...inside] : inside, baselineId: before?.id ?? null };
}

export interface PhaseStats {
  weeks: number;
  startAverageKg: number | null;
  endAverageKg: number | null;
  changeKg: number | null;
}

/** The period's weight story: the first and the last weekly average and how far they moved. */
export function getPhaseStats(logsInPhase: WeightLog[]): PhaseStats {
  const weeks = buildWeeklySummaries(logsInPhase);
  if (weeks.length === 0) return { weeks: 0, startAverageKg: null, endAverageKg: null, changeKg: null };
  const start = weeks[0].averageKg;
  const end = weeks[weeks.length - 1].averageKg;
  return { weeks: weeks.length, startAverageKg: start, endAverageKg: end, changeKg: weeks.length > 1 ? Math.round((end - start) * 10) / 10 : null };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** What is wrong with a list of periods that the user edited, or null when it can be saved. */
export function validatePhases(phases: GoalPhase[]): string | null {
  if (phases.length === 0) return 'צריכה להיות לפחות תקופה אחת.';
  const sorted = [...phases].sort(byStart);
  for (const p of sorted) {
    if (!ISO.test(p.startDate)) return 'לכל תקופה צריך תאריך התחלה.';
    if (p.endDate !== undefined && !ISO.test(p.endDate)) return 'תאריך סיום לא תקין.';
    if (p.endDate !== undefined && p.endDate < p.startDate) return 'תאריך הסיום חייב להיות אחרי ההתחלה.';
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const end = sorted[i].endDate;
    if (end === undefined) return 'רק התקופה האחרונה יכולה להיות בלי תאריך סיום.';
    if (end >= sorted[i + 1].startDate) return 'התקופות לא יכולות לחפוף.';
  }
  return null;
}

/** A readable name for a period: "חיטוב 03.2026 - 09.2026" or "מסה מ-10.2026" for the current one. */
export function describePhase(phase: GoalPhase): string {
  const month = (d: string) => `${d.slice(5, 7)}.${d.slice(0, 4)}`;
  return phase.endDate ? `${PHASE_LABELS[phase.goal]} ${month(phase.startDate)} - ${month(phase.endDate)}` : `${PHASE_LABELS[phase.goal]} מ-${month(phase.startDate)}`;
}

const GOALS: Goal[] = ['lose_weight', 'maintain', 'gain_muscle', 'recomp'];

/** Keeps only the usable periods from stored or restored data; returns undefined when nothing usable is left (the app then derives one from the goal). */
export function sanitizePhases(raw: unknown): GoalPhase[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const phases: GoalPhase[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string' || !GOALS.includes(p.goal as Goal) || typeof p.startDate !== 'string' || !ISO.test(p.startDate)) continue;
    const end = typeof p.endDate === 'string' && ISO.test(p.endDate) && p.endDate >= p.startDate ? p.endDate : undefined;
    phases.push({ id: p.id, goal: p.goal as Goal, startDate: p.startDate, ...(end ? { endDate: end } : {}) });
  }
  return phases.length > 0 && validatePhases(phases) === null ? phases.sort(byStart) : undefined;
}
