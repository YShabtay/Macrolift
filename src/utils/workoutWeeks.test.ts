import { describe, expect, it } from 'vitest';
import type { WorkoutPlan } from '../types/fitness';
import { getWorkoutStreakWeeks, weeklyWorkoutTarget } from './streaks';
import { countCompletedWorkoutsLast7Days } from './workoutStats';

// Three sessions a week: the streak needs 2 of them in a 7-day block.
const PLAN = { id: 'p', title: 't', description: '', daysPerWeek: 3, days: [] } as unknown as WorkoutPlan;
const state = (completed: string[]) => ({ foodLog: [], progress: [], workoutPlan: PLAN, completedWorkoutDates: completed });

// One week of Sun/Tue/Thu (2026-10-04, 06, 08), the next starting on a Saturday: Sat/Mon/Wed (10, 12, 14).
const SUN_WEEK = ['2026-10-04', '2026-10-06', '2026-10-08'];
const SAT_WEEK = ['2026-10-10', '2026-10-12', '2026-10-14'];

describe('countCompletedWorkoutsLast7Days', () => {
  it('counts the 7 days ending today, so a Saturday session is not lost to the week before', () => {
    // Saturday 10th: the 7 days are 4 to 10, so Sunday's three sessions and the Saturday one all count.
    expect(countCompletedWorkoutsLast7Days(PLAN, [], '2026-10-10', [...SUN_WEEK, '2026-10-10'])).toBe(4);
    // A day later the 4th has left the window.
    expect(countCompletedWorkoutsLast7Days(PLAN, [], '2026-10-11', [...SUN_WEEK, '2026-10-10'])).toBe(3);
  });

  it('ignores future days and anything older than 7 days', () => {
    expect(countCompletedWorkoutsLast7Days(PLAN, [], '2026-10-10', ['2026-10-03', '2026-10-11'])).toBe(0);
    expect(countCompletedWorkoutsLast7Days(PLAN, [], '2026-10-10', ['2026-10-04', '2026-10-10'])).toBe(2);
  });
});

describe('getWorkoutStreakWeeks (7-day blocks, not calendar weeks)', () => {
  it('keeps the streak when a Sun/Tue/Thu week is followed by a Sat/Mon/Wed week', () => {
    // Today Thursday 15th: block 9-15 holds 10, 12, 14; block 2-8 holds 4, 6, 8.
    expect(getWorkoutStreakWeeks(state([...SUN_WEEK, ...SAT_WEEK]), '2026-10-15')).toBe(2);
  });

  it('is the same for a plain Sunday-start pattern', () => {
    expect(getWorkoutStreakWeeks(state([...SUN_WEEK, '2026-10-11', '2026-10-13', '2026-10-15']), '2026-10-15')).toBe(2);
  });

  it('does not break while the latest block is still short, but a missed block does', () => {
    // Only one session in the last 7 days so far: the streak counts what came before.
    expect(getWorkoutStreakWeeks(state([...SUN_WEEK, '2026-10-13']), '2026-10-16')).toBe(1);
    // Nothing for two blocks: the streak is over.
    expect(getWorkoutStreakWeeks(state(SUN_WEEK), '2026-10-25')).toBe(0);
  });

  it('forgives one missed session (target is plan frequency minus one)', () => {
    expect(weeklyWorkoutTarget(3)).toBe(2);
    expect(getWorkoutStreakWeeks(state(['2026-10-04', '2026-10-08', '2026-10-11', '2026-10-15']), '2026-10-15')).toBe(2);
  });
});
