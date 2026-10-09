import type { FoodEntry, NutritionPlan, WeeklyBalanceAdjustment } from '../types/fitness';
import { addDaysIso } from './dateMath';
import { sumTotals } from './nutritionLog';
import { getDailyTargets, getStepAllowanceKcal } from './weeklyBalance';
import { daysBetween, getWeekEnd, getWeekStart } from './weightCalculations';

/** The suggested pace for a day may move this far from that day's own target - a gentle flex, not a free-for-all. */
export const PACE_FLEX = 0.15;

export interface WeeklyCalorieBudget {
  weekStart: string;
  weekEnd: string;
  /** The week's total target: the sum of each day's target (a rebalance reduction and any step allowance put on a day included). */
  weeklyTarget: number;
  /** Calories logged on the days of the week up to and including `today` (the whole week for a past week). */
  eaten: number;
  /** Weekly target minus eaten; negative once the week's budget is exceeded. */
  remaining: number;
  /** Past days of the week with nothing logged. The suggested pace treats them as days that met their target, so an untracked day never inflates it. */
  unloggedDays: number;
  /** Only for the week containing today: the suggested intake for today - what's left of the budget before today, spread over the days left. */
  pace: {
    kcal: number;
    /** Today's own target, with the calories from steps above the goal when that mode is on. */
    target: number;
    /** The part of today's target that came from steps (0 normally). */
    stepBonusKcal: number;
    daysLeft: number;
    clamped: 'up' | 'down' | null;
  } | null;
  isCurrentWeek: boolean;
}

/**
 * Weekly calorie budget for the week containing `date`. For the current week it also suggests today's intake: the budget left after the
 * days before today, divided by the days remaining, kept within 15% of today's own target and never below the user's BMR.
 * Calories from steps above the goal ('add_calories' mode) sit in the target of the day they were walked on: that day's bonus is not shared with the
 * other days, so it is taken out of the shared budget and added back to the day it belongs to.
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
  let allocated = 0;
  let allowanceBefore = 0;
  let eaten = 0;
  let assumedBeforeToday = 0;
  let unloggedDays = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDaysIso(weekStart, i);
    weeklyTarget += getDailyTargets(plan, adjustment, day).calories;
    const allowance = getStepAllowanceKcal(adjustment, day);
    allocated += allowance;
    if (day < today) allowanceBefore += allowance;
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
    const todayAllowance = getStepAllowanceKcal(adjustment, today);
    const target = getDailyTargets(plan, adjustment, today).calories;
    const baseTarget = target - todayAllowance;
    // What is left of the base budget (the targets without the step calories; what earlier days ate on their step calories did not use it up) is shared
    // over every remaining day. Today's own step calories go on top, outside the flex limits.
    const shared = (weeklyTarget - allocated - assumedBeforeToday + allowanceBefore) / daysLeft;
    const low = Math.max(baseTarget * (1 - PACE_FLEX), plan.bmr);
    const high = baseTarget * (1 + PACE_FLEX);
    const kcal = Math.round(Math.min(Math.max(shared, low), Math.max(high, low)) + todayAllowance);
    pace = { kcal, target, stepBonusKcal: todayAllowance, daysLeft, clamped: shared < low ? 'down' : shared > high ? 'up' : null };
  }

  return { weekStart, weekEnd, weeklyTarget: Math.round(weeklyTarget), eaten: Math.round(eaten), remaining: Math.round(weeklyTarget - eaten), unloggedDays, pace, isCurrentWeek };
}
