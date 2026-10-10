import { describe, expect, it } from 'vitest';
import type { WorkoutPlan } from '../types/fitness';
import { getWorkoutStreakWeeks, weeklyWorkoutTarget } from './streaks';
import { getWorkoutWeekProgress } from './workoutStats';

// Three sessions a week: the streak needs 2 of them in a 7-day block.
const PLAN = { id: 'p', title: 't', description: '', daysPerWeek: 3, days: [] } as unknown as WorkoutPlan;
const state = (completed: string[]) => ({ foodLog: [], progress: [], workoutPlan: PLAN, completedWorkoutDates: completed });

// One week of Sun/Tue/Thu (2026-10-04, 06, 08), the next starting on a Saturday: Sat/Mon/Wed (10, 12, 14).
const SUN_WEEK = ['2026-10-04', '2026-10-06', '2026-10-08'];
const SAT_WEEK = ['2026-10-10', '2026-10-12', '2026-10-14'];

describe('getWorkoutWeekProgress: the counter wraps after the plan\'s sessions', () => {
  const week = (dates: string[], today: string, target = 3) => getWorkoutWeekProgress(PLAN, [], target, today, dates);

  it('counts 1/3, 2/3, 3/3 and then starts again at 1/3 with the next workout', () => {
    expect(week(['2026-10-04'], '2026-10-04').count).toBe(1);
    expect(week(['2026-10-04', '2026-10-06'], '2026-10-06').count).toBe(2);
    expect(week(SUN_WEEK, '2026-10-08').count).toBe(3);
    expect(week(SUN_WEEK, '2026-10-09').count).toBe(3); // still the finished week the day after
    // A Saturday session after a finished Sun/Tue/Thu week starts the next training week.
    expect(week([...SUN_WEEK, '2026-10-10'], '2026-10-10')).toEqual({ count: 1, target: 3 });
    expect(week([...SUN_WEEK, '2026-10-10'], '2026-10-11').count).toBe(1);
    expect(week([...SUN_WEEK, ...SAT_WEEK], '2026-10-14').count).toBe(3);
  });

  it('uses the plan\'s number of sessions as the limit', () => {
    const four = ['2026-10-04', '2026-10-05', '2026-10-07', '2026-10-08'];
    expect(week(four, '2026-10-08', 4)).toEqual({ count: 4, target: 4 });
    expect(week([...four, '2026-10-09'], '2026-10-09', 4).count).toBe(1);
  });

  it('a week that began more than 7 days ago and was not finished is over: 0 until the next workout, which starts a new one', () => {
    expect(week(['2026-10-04', '2026-10-06'], '2026-10-10').count).toBe(2); // still inside its 7 days
    expect(week(['2026-10-04', '2026-10-06'], '2026-10-11').count).toBe(0);
    expect(week(['2026-10-04', '2026-10-06', '2026-10-12'], '2026-10-12').count).toBe(1);
    expect(week(SUN_WEEK, '2026-10-11').count).toBe(0); // a finished week is also over after its 7 days
  });

  it('ignores future dates, and is 0 with no workouts', () => {
    expect(week([], '2026-10-10').count).toBe(0);
    expect(week(['2026-10-12'], '2026-10-10').count).toBe(0);
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
