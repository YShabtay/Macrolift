import type { StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { getStepCredit } from './stepCredit';
import { getActiveAdjustment, sumStepAllowance } from './weeklyBalance';
import { addDaysIso } from './dateMath';
import { daysBetween, getWeekStart } from './weightCalculations';

/** A credit smaller than this is not worth turning into a larger target. */
export const MIN_ALLOWANCE_CREDIT_KCAL = 10;

/**
 * The user's choice of when to eat the week's net step credit: `days` = 1 puts all of it on today, 2 splits it over today and tomorrow, and so on;
 * null (or as many days as are left) leaves it unallocated, which means it is shared over all the days left. The entries for earlier days are kept
 * as they were, so changing the choice never rewrites a day that has passed, and only what is left of the credit is allocated. Returns the new
 * week adjustment, with the rest of it (rebalance choices) untouched.
 */
export function chooseStepAllowance(params: {
  adjustment: WeeklyBalanceAdjustment | undefined;
  stepLogs: StepLog[];
  baseStepGoal: number;
  today: string;
  days: number | null;
}): WeeklyBalanceAdjustment {
  const { adjustment, stepLogs, baseStepGoal, today, days } = params;
  const weekStart = getWeekStart(today);
  const active = getActiveAdjustment(adjustment, today) ?? { weekStart };
  const kept = Object.fromEntries(Object.entries(active.stepAllowance ?? {}).filter(([day, kcal]) => day < today && kcal > 0));

  const daysLeft = 7 - daysBetween(weekStart, today);
  const credit = getStepCredit({ stepLogs, baseGoal: baseStepGoal, adjustment: active, asOf: today }).netKcal;
  const spentBefore = Object.values(kept).reduce((a, b) => a + b, 0);
  const available = credit - spentBefore;

  const entries: Record<string, number> = { ...kept };
  if (days !== null && days < daysLeft && available >= MIN_ALLOWANCE_CREDIT_KCAL) {
    const n = Math.max(1, Math.round(days));
    const perDay = Math.round(available / n);
    for (let i = 0; i < n; i++) entries[addDaysIso(today, i)] = perDay;
  }

  const { stepAllowance: _previous, ...rest } = active;
  return Object.keys(entries).length > 0 ? { ...rest, stepAllowance: entries } : rest;
}

/** How many of the days from today on carry a step allowance (0 = the credit is simply shared over the days left). */
export function countAllowanceDaysFrom(adjustment: WeeklyBalanceAdjustment | undefined, today: string): number {
  const active = getActiveAdjustment(adjustment, today);
  return Object.entries(active?.stepAllowance ?? {}).filter(([day, kcal]) => day >= today && kcal > 0).length;
}

export { sumStepAllowance };
