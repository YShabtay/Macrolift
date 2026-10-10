import { describe, expect, it } from 'vitest';
import { calculateNutritionPlan } from './calculations';
import { buildDemoMetrics, buildDemoPhases, buildDemoStepLogs, buildDemoWeekFoodLog, buildDemoWeightLogs } from './demoData';
import { filterLogsToPhase, getPhaseStats, validatePhases } from './phases';
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

describe('demo data for the progress periods', () => {
  const TODAY = '2026-10-10';
  const phases = buildDemoPhases();
  const logs = buildDemoWeightLogs(68.8, TODAY);

  it('has a cut that ends the day before the bulk starts, and the bulk is still going', () => {
    expect(validatePhases(phases)).toBeNull();
    expect(phases.map((p) => p.goal)).toEqual(['lose_weight', 'gain_muscle']);
    expect(phases[0].endDate).toBe('2026-03-14');
    expect(phases[1].endDate).toBeUndefined();
  });

  it('has one weigh-in per date, every weigh-in inside one of the periods, ending at today\'s weight', () => {
    expect(new Set(logs.map((l) => l.date)).size).toBe(logs.length);
    expect(logs.every((l) => phases.some((p) => filterLogsToPhase([l], p, TODAY).length === 1))).toBe(true);
    expect(logs[logs.length - 1]).toMatchObject({ date: TODAY, weightKg: 68.8 });
  });

  it('tells a cut that lost weight and a bulk that gained it', () => {
    const cut = getPhaseStats(filterLogsToPhase(logs, phases[0], TODAY));
    const bulk = getPhaseStats(filterLogsToPhase(logs, phases[1], TODAY));
    expect(cut.changeKg).toBeLessThan(-4);
    expect(bulk.changeKg).toBeGreaterThan(1);
  });
});

