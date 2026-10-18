import type { FoodEntry, NutritionPlan, StepLog, WeeklyBalanceAdjustment } from '../types/fitness';
import { addDaysIso } from './dateMath';
import { getOvershootCoverage } from './overshoot';
import { withStepMode, type StepMode } from './weeklySteps';
import { getWeekStart } from './weightCalculations';

/**
 * What a week leaves for the next one. The body answers to the weeks, not to a Sunday that resets the count: calories not eaten last week are room this
 * week, and calories eaten over are owed. This is the running balance of the last few weeks, each week judged exactly like the screen judges it (days
 * with food logged, the step calories, the day closed), with what came into that week counted in:
 *   carry out of a week = carry into it, minus what that week went over by (so a week that used the room leaves less, a week under adds to it).
 * It is limited both ways, so a week of not logging, an illness or a trip cannot become a licence to eat (or a debt) of thousands of calories, and a week
 * with nothing logged ends the chain.
 */
export const MAX_CARRY_KCAL = 500;
/** How many earlier weeks are looked at; older ones have faded. */
const CARRY_LOOKBACK_WEEKS = 4;

export interface CarryParams {
  mode: StepMode;
  stepLogs: StepLog[];
  foodLog: FoodEntry[];
  plan: NutritionPlan;
  targetDailySteps: number;
  weightKg: number;
}

/** The balance the week starting `weekStart` begins with: positive = calories not eaten before it, negative = calories eaten over. */
export function getWeekCarryIn(params: CarryParams, weekStart: string): number {
  const { foodLog, plan } = params;
  let carry = 0;
  for (let k = CARRY_LOOKBACK_WEEKS; k >= 1; k--) {
    const start = addDaysIso(weekStart, -7 * k);
    // The week is judged up to its last day with food logged (an unlogged Saturday is not a day of eating nothing).
    let lastLogged: string | null = null;
    for (let i = 0; i < 7; i++) {
      const day = addDaysIso(start, i);
      if (foodLog.some((f) => f.date === day)) lastLogged = day;
    }
    if (lastLogged === null) {
      carry = 0;
      continue;
    }
    const adjustment = withStepMode(undefined, { ...params, today: lastLogged, carryInKcal: carry });
    const coverage = getOvershootCoverage({ foodLog, plan, adjustment, today: lastLogged, todayClosed: true });
    carry = Math.max(-MAX_CARRY_KCAL, Math.min(MAX_CARRY_KCAL, Math.round(-coverage.weekOverSoFarKcal))) || 0;
  }
  return carry;
}

/**
 * The adjustment every calorie screen reads for the week of `params.today`: the saved rebalance choices, the step calories and what the earlier weeks left.
 * (`withStepMode` does the steps; the carry-over needs the overshoot check, which is why it is derived here.)
 */
export function deriveWeeklyAdjustment(saved: WeeklyBalanceAdjustment | undefined, params: CarryParams & { today: string }): WeeklyBalanceAdjustment | undefined {
  const carryInKcal = getWeekCarryIn(params, getWeekStart(params.today));
  return withStepMode(saved, { ...params, carryInKcal });
}
