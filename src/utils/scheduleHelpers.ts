import type { SetProgressEntry, WorkoutPlan, WorkoutScheduleEntry, WorkoutSplitType } from '../types/fitness';
import { formatIsoDate, parseIsoDate, todayIso } from './weightCalculations';

export const REST_DAY_ID = 'rest';
export const CUSTOM_DAY_ID = 'custom';

/** True when every exercise of the given plan day was fully completed on that date. */
export function isDayCompleted(workoutPlan: WorkoutPlan, progress: SetProgressEntry[], date: string, dayId?: string): boolean {
  const daysToCheck = dayId ? workoutPlan.days.filter((d) => d.id === dayId) : workoutPlan.days;
  return daysToCheck.some(
    (day) =>
      day.exercises.length > 0 &&
      day.exercises.every((ex) => {
        const entry = progress.find((p) => p.date === date && p.dayId === day.id && p.exerciseId === ex.id);
        return (entry?.completedSets ?? 0) >= ex.sets;
      }),
  );
}

/** A day counts as trained when its plan workout was fully logged set by set, or the user marked that date completed. */
export function isWorkoutDateDone(
  workoutPlan: WorkoutPlan,
  progress: SetProgressEntry[],
  date: string,
  completedDates: readonly string[] = [],
): boolean {
  return completedDates.includes(date) || isDayCompleted(workoutPlan, progress, date);
}

/** Drops schedule entries that point at a plan day which no longer exists (e.g. after the plan was regenerated); rest/custom entries are kept. */
export function pruneStaleSchedule(schedule: WorkoutScheduleEntry[], workoutPlan: WorkoutPlan): WorkoutScheduleEntry[] {
  return schedule.filter(
    (s) => s.dayId === REST_DAY_ID || s.dayId === CUSTOM_DAY_ID || workoutPlan.days.some((d) => d.id === s.dayId),
  );
}

export function getScheduleForDate(
  schedule: WorkoutScheduleEntry[],
  date: string,
): WorkoutScheduleEntry | undefined {
  return schedule.find((s) => s.date === date);
}

/** The plan day scheduled for today, if any and if it's a real plan day (not rest/custom); otherwise the first day. */
export function getTodaysPlanDay(
  workoutPlan: WorkoutPlan,
  schedule: WorkoutScheduleEntry[],
): WorkoutPlan['days'][number] {
  const entry = getScheduleForDate(schedule, todayIso());
  if (entry && entry.dayId !== REST_DAY_ID && entry.dayId !== CUSTOM_DAY_ID) {
    const day = workoutPlan.days.find((d) => d.id === entry.dayId);
    if (day) return day;
  }
  return workoutPlan.days[0];
}

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isCompleted: boolean;
  scheduled?: WorkoutScheduleEntry;
}

/** Builds a 6-week (42-day) grid for the given month, starting on the Sunday on/before the 1st. */
export function buildMonthGrid(
  year: number,
  month: number, // 0-indexed, matches Date
  workoutPlan: WorkoutPlan,
  progress: SetProgressEntry[],
  schedule: WorkoutScheduleEntry[],
  completedDates: readonly string[] = [],
): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());

  const today = todayIso();
  const days: CalendarDay[] = [];

  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const dateStr = formatIsoDate(date);
    days.push({
      date: dateStr,
      dayOfMonth: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateStr === today,
      isCompleted: isWorkoutDateDone(workoutPlan, progress, dateStr, completedDates),
      scheduled: getScheduleForDate(schedule, dateStr),
    });
  }

  return days;
}

/** Builds the 7 days (Sunday - Saturday) of the calendar week containing `dateStr`. */
export function buildWeekGrid(
  dateStr: string,
  workoutPlan: WorkoutPlan,
  progress: SetProgressEntry[],
  schedule: WorkoutScheduleEntry[],
  completedDates: readonly string[] = [],
): CalendarDay[] {
  const date = parseIsoDate(dateStr);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());

  const today = todayIso();
  const currentMonth = date.getMonth();
  const days: CalendarDay[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dStr = formatIsoDate(d);
    days.push({
      date: dStr,
      dayOfMonth: d.getDate(),
      isCurrentMonth: d.getMonth() === currentMonth,
      isToday: dStr === today,
      isCompleted: isWorkoutDateDone(workoutPlan, progress, dStr, completedDates),
      scheduled: getScheduleForDate(schedule, dStr),
    });
  }

  return days;
}

// ---------------------------------------------------------------------------
// Program scheduling
// ---------------------------------------------------------------------------

/**
 * Which weekdays (0 = Sunday) each program trains on, keyed by how many workouts the plan has. Spaced so heavy sessions
 * for the same muscles aren't back to back: 3 days = Sun/Tue/Thu, 4 days = Sun/Mon/Wed/Thu (A, B, A, B), 5 = Sun-Tue + Thu/Fri.
 */
const PROGRAM_WEEKDAYS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/**
 * Spreads a program's workouts over the calendar: the plan's days are assigned in order to the program's weekdays, for the
 * rest of this week and the next `extraWeeks` weeks. Dates that already have an entry (rest days, custom workouts), are in the past, or
 * are in `skipDates` (already trained) are left alone, and `existing` is returned with the new entries added.
 */
export function distributeProgramSchedule(
  workoutPlan: WorkoutPlan,
  existing: WorkoutScheduleEntry[],
  today: string = todayIso(),
  extraWeeks = 3,
  skipDates: readonly string[] = [],
): WorkoutScheduleEntry[] {
  const weekdays = PROGRAM_WEEKDAYS[Math.min(Math.max(workoutPlan.days.length, 1), 7)];
  const taken = new Set(existing.map((e) => e.date));
  const added: WorkoutScheduleEntry[] = [];

  const weekStart = parseIsoDate(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  for (let week = 0; week <= extraWeeks; week++) {
    weekdays.forEach((weekday, index) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + week * 7 + weekday);
      const date = formatIsoDate(d);
      if (date < today || taken.has(date) || skipDates.includes(date)) return;
      added.push({ date, dayId: workoutPlan.days[index].id });
    });
  }

  return [...existing, ...added];
}

const WORKOUT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Workout name letter: AB (upper/lower) alternates A, B, A, B across the week; other programs number their workouts A, B, C... */
export function workoutLetter(splitType: WorkoutSplitType, index: number): string {
  return splitType === 'upper_lower' ? WORKOUT_LETTERS[index % 2] : (WORKOUT_LETTERS[index] ?? String(index + 1));
}

export const SPLIT_SHORT_LABELS: Record<WorkoutSplitType, string> = { fbw: 'FBW', upper_lower: 'AB', ppl: 'PPL' };
