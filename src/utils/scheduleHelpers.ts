import type { SetProgressEntry, WorkoutPlan, WorkoutScheduleEntry } from '../types/fitness';
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
      isCompleted: isDayCompleted(workoutPlan, progress, dateStr),
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
      isCompleted: isDayCompleted(workoutPlan, progress, dStr),
      scheduled: getScheduleForDate(schedule, dStr),
    });
  }

  return days;
}
