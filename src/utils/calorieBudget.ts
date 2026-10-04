import type { FoodEntry, NutritionPlan, WeeklyBalanceAdjustment } from '../types/fitness';
import { addDaysIso } from './dateMath';
import { sumTotals } from './nutritionLog';
import { getDailyTargets } from './weeklyBalance';
import { daysBetween, getWeekEnd, getWeekStart } from './weightCalculations';

/** The suggested pace for a day may move this far from that day's own target - a gentle flex, not a free-for-all. */
export const PACE_FLEX = 0.15;

export interface WeeklyCalorieBudget {
  weekStart: string;
  weekEnd: string;
  /** The week's total target: the sum of each day's target (a rebalance reduction included). */
  weeklyTarget: number;
  /** Calories logged on the days of the week up to and including `today` (the whole week for a past week). */
  eaten: number;
  /** Weekly target minus eaten; negative once the week's budget is exceeded. */
  remaining: number;
  /** Past days of the week with nothing logged. The suggested pace treats them as days that met their target, so an untracked day never inflates it. */
  unloggedDays: number;
  /** Only for the week containing today: the suggested intake for today - what's left of the budget before today, spread over the days left. */
  pace: { kcal: number; target: number; daysLeft: number; clamped: 'up' | 'down' | null } | null;
  isCurrentWeek: boolean;
}

/**
 * Weekly calorie budget for the week containing `date`. For the current week it also suggests today's intake: the budget left after the
 * days before today, divided by the days remaining, kept within 15% of today's own target and never below the user's BMR.
 */
export function getWeeklyCalorieBudget(
  foodLog: FoodEntry[],
  plan: NutritionPlan,
  adjustment: WeeklyBalanceAdjustment | undefined,
  date: string,
  today: string,
): WeeklyCalorieBudget {
  const weekStart = getWeekStart(date);
  const weekEnd = getWeekEnd(date);
  const isCurrentWeek = today >= weekStart && today <= weekEnd;
  const lastDay = weekEnd < today ? weekEnd : today;

  let weeklyTarget = 0;
  let eaten = 0;
  let assumedBeforeToday = 0;
  let unloggedDays = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDaysIso(weekStart, i);
    weeklyTarget += getDailyTargets(plan, adjustment, day).calories;
    if (day > lastDay) continue;
    const entries = foodLog.filter((f) => f.date === day);
    const kcal = sumTotals(entries).calories;
    eaten += kcal;
    if (day < today) {
      if (entries.length === 0) {
        unloggedDays += 1;
        assumedBeforeToday += getDailyTargets(plan, adjustment, day).calories;
      } else {
        assumedBeforeToday += kcal;
      }
    }
  }

  let pace: WeeklyCalorieBudget['pace'] = null;
  if (isCurrentWeek) {
    const daysLeft = 7 - daysBetween(weekStart, today);
    const target = getDailyTargets(plan, adjustment, today).calories;
    const raw = (weeklyTarget - assumedBeforeToday) / daysLeft;
    const low = Math.max(target * (1 - PACE_FLEX), plan.bmr);
    const high = target * (1 + PACE_FLEX);
    const kcal = Math.round(Math.min(Math.max(raw, low), Math.max(high, low)));
    pace = { kcal, target, daysLeft, clamped: raw < low ? 'down' : raw > high ? 'up' : null };
  }

  return { weekStart, weekEnd, weeklyTarget: Math.round(weeklyTarget), eaten: Math.round(eaten), remaining: Math.round(weeklyTarget - eaten), unloggedDays, pace, isCurrentWeek };
}
