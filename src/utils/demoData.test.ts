import { describe, expect, it } from 'vitest';
import { calculateNutritionPlan } from './calculations';
import { buildDemoMetrics, buildDemoStepLogs, buildDemoWeekFoodLog } from './demoData';
import { getOvershootCoverage, shouldOfferRebalance } from './overshoot';
import { stepNetKcal, withStepMode } from './weeklySteps';

// The demo account is what screenshots and visitors see: it has to show the step chart with long and short days, a bank, and a week that is over.
describe('demo data for the steps and calories screens', () => {
  const metrics = buildDemoMetrics();
  const plan = calculateNutritionPlan(metrics);
  const goal = metrics.averageDailySteps;
  const SATURDAY = '2026-10-10';

  it('has both days above and days below the step goal in the same week', () => {
    const logs = buildDemoStepLogs(goal, SATURDAY);
    const week = logs.filter((s) => s.date >= '2026-10-04' && s.date < SATURDAY);
    const net = week.map((s) => stepNetKcal(s.steps, true, goal, metrics.weightKg));
    expect(net.some((n) => n > 0)).toBe(true);
    expect(net.some((n) => n < 0)).toBe(true);
    expect(logs.find((s) => s.date === SATURDAY)?.steps).toBeGreaterThan(goal);
  });

  it('puts a week of meals before today, each day near the target', () => {
    const food = buildDemoWeekFoodLog(plan, SATURDAY);
    expect(new Set(food.map((f) => f.date)).size).toBe(6); // Sunday to Friday
    expect(food.every((f) => f.date < SATURDAY)).toBe(true);
    expect(buildDemoWeekFoodLog(plan, '2026-10-04')).toEqual([]); // nothing before a Sunday
  });

  it('shows a week that is over, so the rebalance screen has something to explain, even with the step calories counted', () => {
    const foodLog = buildDemoWeekFoodLog(plan, SATURDAY);
    const stepLogs = buildDemoStepLogs(goal, SATURDAY);
    const adjustment = withStepMode(undefined, { mode: 'add_calories', stepLogs, foodLog, plan, targetDailySteps: goal, weightKg: metrics.weightKg, today: SATURDAY });
    const coverage = getOvershootCoverage({ foodLog, plan, adjustment, today: SATURDAY });
    expect(coverage.weekOverSoFarKcal).toBeGreaterThan(50);
    expect(shouldOfferRebalance(coverage)).toBe(true);
    expect(coverage.unspentBankKcal).toBeGreaterThan(0); // today's good step day leaves a bank
  });
});
