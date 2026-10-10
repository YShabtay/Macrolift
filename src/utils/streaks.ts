import type { AppState } from '../types/fitness';
import { isWorkoutDateDone } from './scheduleHelpers';
import { addDaysIso } from './dateMath';

const MAX_LOOKBACK_WEEKS = 104;
const MAX_LOOKBACK_DAYS = 400;

/** Total workout counts that get a badge. */
export const WORKOUT_MILESTONES = [1, 5, 10, 25, 50, 100, 200, 365];

type StreakState = Pick<AppState, 'foodLog' | 'progress' | 'workoutPlan' | 'completedWorkoutDates'>;

/**
 * Days in a row with at least one meal logged. Counted back from today - and a day that simply hasn't had its first meal yet doesn't
 * break the streak, so it starts from yesterday until something is logged today.
 */
export function getLoggingStreakDays(foodLog: AppState['foodLog'], today: string): number {
  const logged = new Set(foodLog.map((f) => f.date));
  let cursor = logged.has(today) ? today : addDaysIso(today, -1);
  let streak = 0;
  while (logged.has(cursor) && streak < MAX_LOOKBACK_DAYS) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}

/** All dates on which a workout counts as done (fully logged, or marked completed). */
export function getDoneWorkoutDates(state: StreakState): string[] {
  const completed = state.completedWorkoutDates ?? [];
  const candidates = new Set([...state.progress.map((p) => p.date), ...completed]);
  return [...candidates].filter((d) => isWorkoutDateDone(state.workoutPlan, state.progress, d, completed)).sort();
}

/** How many workouts a week has to hold to count toward the streak: the plan's frequency minus one (a missed session is forgiven), at least 1. */
export function weeklyWorkoutTarget(daysPerWeek: number): number {
  return Math.max(daysPerWeek - 1, 1);
}

/**
 * Consecutive training weeks that reached the weekly workout target. A training week is a block of 7 days counted back from today (not the Sunday-Saturday
 * calendar week), so a person who starts one week on a Saturday and the next on a Sunday keeps the streak. The latest block counts once it has reached the
 * target, but being short of it so far doesn't break the streak - the days of a block can still come.
 */
export function getWorkoutStreakWeeks(state: StreakState, today: string): number {
  const done = new Set(getDoneWorkoutDates(state));
  const inBlock = (blockEnd: string) => {
    let count = 0;
    for (let i = 0; i < 7; i++) if (done.has(addDaysIso(blockEnd, -i))) count += 1;
    return count;
  };
  const target = weeklyWorkoutTarget(state.workoutPlan.daysPerWeek);
  let cursor = inBlock(today) >= target ? today : addDaysIso(today, -7);
  let streak = 0;
  while (inBlock(cursor) >= target && streak < MAX_LOOKBACK_WEEKS) {
    streak += 1;
    cursor = addDaysIso(cursor, -7);
  }
  return streak;
}

export interface WorkoutMilestone {
  total: number;
  /** The highest milestone already reached, if any. */
  reached: number | null;
  /** The next milestone to aim for, and how many workouts away it is. */
  next: number | null;
  remaining: number | null;
}

export function getWorkoutMilestone(totalWorkouts: number): WorkoutMilestone {
  const reached = [...WORKOUT_MILESTONES].reverse().find((m) => totalWorkouts >= m) ?? null;
  const next = WORKOUT_MILESTONES.find((m) => totalWorkouts < m) ?? null;
  return { total: totalWorkouts, reached, next, remaining: next === null ? null : next - totalWorkouts };
}
