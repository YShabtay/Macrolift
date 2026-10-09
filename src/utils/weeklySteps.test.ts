import { describe, expect, it } from 'vitest';
import type { StepLog } from '../types/fitness';
import { getWeeklyStepsPlan } from './weeklySteps';

// The user's week (Sunday 4 Oct start), goal 4,500 a day.
const GOAL = 4500;
const steps = (date: string, n: number): StepLog => ({ date, steps: n });
const WEEK: StepLog[] = [steps('2026-10-04', 8846), steps('2026-10-05', 3818), steps('2026-10-06', 5821), steps('2026-10-07', 2344)];

describe('getWeeklyStepsPlan', () => {
  it('turns a surplus into a lighter day: the whole of it today, or spread over the days left', () => {
    const plan = getWeeklyStepsPlan(GOAL, undefined, WEEK, '2026-10-08'); // Thursday: 3 days left (Thu, Fri, Sat)
    expect(plan.balanceBefore).toBe(2829); // +4,346 -682 +1,321 -2,156
    expect(plan.weeklyTarget).toBe(31500);
    expect(plan.remainingFromDate).toBe(31500 - 20829);
    expect(plan.paceToday).toBe(Math.ceil(10671 / 3)); // 3,557 a day
    expect(plan.takeAllToday).toBe(10671 - GOAL * 2); // 1,671 today and the plain average after
  });

  it('turns a gap into a heavier day: all of it today, or spread', () => {
    const behind = [steps('2026-10-04', 2000), steps('2026-10-05', 3000)];
    const plan = getWeeklyStepsPlan(GOAL, undefined, behind, '2026-10-06'); // Tuesday: 5 days left
    expect(plan.balanceBefore).toBe(-4000); // -2,500 and -1,500
    expect(plan.paceToday).toBe(Math.ceil((31500 - 5000) / 5)); // 5,300
    expect(plan.takeAllToday).toBe(GOAL + 4000); // 8,500: the plain day plus the whole gap
  });

  it('lets today be a rest day when the surplus already covers it', () => {
    const plan = getWeeklyStepsPlan(GOAL, undefined, [steps('2026-10-04', 30000)], '2026-10-05');
    expect(plan.takeAllToday).toBe(Math.max(0, 31500 - 30000 - GOAL * 5));
    expect(plan.takeAllToday).toBe(0);
  });

  it('counts a day with no entry as exactly on target, not as zero steps (same rule as the calorie side)', () => {
    const plan = getWeeklyStepsPlan(GOAL, undefined, [steps('2026-10-04', 8846)], '2026-10-08');
    expect(plan.unloggedDaysBefore).toBe(3);
    expect(plan.balanceBefore).toBe(4346);
    expect(plan.walkedThisWeek).toBe(8846);
    expect(plan.averageSoFar).toBe(4423); // the logged Sunday and today (nothing logged yet), not the unknown days
  });

  it('a day logged as zero is a real zero', () => {
    const plan = getWeeklyStepsPlan(GOAL, undefined, [steps('2026-10-04', 0)], '2026-10-05');
    expect(plan.unloggedDaysBefore).toBe(0);
    expect(plan.balanceBefore).toBe(-GOAL);
  });

  it('on the last day, "all today" and the spread are the same number', () => {
    const plan = getWeeklyStepsPlan(GOAL, undefined, WEEK, '2026-10-10');
    expect(plan.daysLeft).toBe(1);
    expect(plan.takeAllToday).toBe(plan.remainingFromDate);
  });
});
