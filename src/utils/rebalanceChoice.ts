import type { WeeklyBalanceAdjustment } from '../types/fitness';

/** What the user picked on the rebalance screen (the same shape the screen reports). */
export type RebalanceChoiceInput =
  | { kind: 'taper'; reductionKcal: number; fromDate: string }
  | { kind: 'steps'; boost: number; days: number; fromDate: string; toDate?: string }
  | { kind: 'keep' };

/**
 * The week's adjustment after a rebalance choice. One way of making the overshoot up is active at a time: lowering the next days' targets, or walking
 * more. Choosing one replaces the other, and "carry on as usual" clears both, so the screen can always be used to change or cancel what was planned.
 * Step allowances (the credit the user put on days) are a separate thing and stay.
 */
export function applyRebalanceChoice(current: WeeklyBalanceAdjustment, choice: RebalanceChoiceInput): WeeklyBalanceAdjustment {
  const { calorie: _calorie, steps: _steps, ...rest } = current;
  if (choice.kind === 'taper') return { ...rest, calorie: { reductionKcal: choice.reductionKcal, fromDate: choice.fromDate } };
  if (choice.kind === 'steps') return { ...rest, steps: { boost: choice.boost, days: choice.days, fromDate: choice.fromDate, toDate: choice.toDate } };
  return rest;
}
