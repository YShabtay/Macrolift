import type { UserMetrics, WorkoutPlan } from '../types/fitness';

/** Seconds a set takes to perform; the rest between sets comes from the plan itself. */
export const WORK_SECONDS_PER_SET = 45;
/** Warm-up and moving between exercises, added to every session. */
export const WARMUP_MINUTES = 5;
/** What the training estimate assumes when there is no plan to read (a session of about an hour, rest periods included). */
export const DEFAULT_SESSION_MINUTES = 60;
const MIN_SESSION_MINUTES = 25;
const MAX_SESSION_MINUTES = 90;

/**
 * How long the plan's sessions take on average, from its own sets and rests: every set is about 45 seconds of work plus the exercise's rest, and a warm-up
 * on top. So a program with long rests or many sets counts as longer than one with short ones, without the person entering anything. A plan with no
 * exercises gives the default. Kept between 25 and 90 minutes, whatever a custom plan holds.
 */
export function estimateSessionMinutes(plan: Pick<WorkoutPlan, 'days'> | undefined): number {
  const sessions = (plan?.days ?? []).filter((d) => d.exercises.length > 0);
  if (sessions.length === 0) return DEFAULT_SESSION_MINUTES;
  const minutes = sessions.map((d) => d.exercises.reduce((sum, e) => sum + e.sets * (WORK_SECONDS_PER_SET + e.restSeconds), 0) / 60 + WARMUP_MINUTES);
  const average = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  return Math.round(Math.min(Math.max(average, MIN_SESSION_MINUTES), MAX_SESSION_MINUTES));
}

/** The metrics with the session length of the given plan, which the calorie estimate reads. Call it whenever the plan changes. */
export function withSessionMinutes(metrics: UserMetrics, plan: Pick<WorkoutPlan, 'days'> | undefined): UserMetrics {
  return { ...metrics, sessionMinutes: estimateSessionMinutes(plan) };
}
