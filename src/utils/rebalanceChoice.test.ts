import { describe, expect, it } from 'vitest';
import { applyRebalanceChoice } from './rebalanceChoice';

const base = { weekStart: '2026-10-04', stepAllowance: { '2026-10-08': 100 } };

describe('applyRebalanceChoice', () => {
  it('lowers the next days, and replaces an earlier walking choice', () => {
    const withSteps = { ...base, steps: { boost: 1000, days: 2, fromDate: '2026-10-09' } };
    const next = applyRebalanceChoice(withSteps, { kind: 'taper', reductionKcal: 98, fromDate: '2026-10-09' });
    expect(next.calorie).toEqual({ reductionKcal: 98, fromDate: '2026-10-09' });
    expect(next.steps).toBeUndefined();
  });
  it('walks more, and replaces an earlier lowered-target choice', () => {
    const withTaper = { ...base, calorie: { reductionKcal: 98, fromDate: '2026-10-09' } };
    const next = applyRebalanceChoice(withTaper, { kind: 'steps', boost: 2400, days: 2, fromDate: '2026-10-09' });
    expect(next.steps).toMatchObject({ boost: 2400, days: 2 });
    expect(next.calorie).toBeUndefined();
  });
  it('"carry on as usual" clears both, so the planned compensation can be cancelled', () => {
    const both = { ...base, calorie: { reductionKcal: 98, fromDate: '2026-10-09' }, steps: { boost: 1000, days: 2, fromDate: '2026-10-09' } };
    const next = applyRebalanceChoice(both, { kind: 'keep' });
    expect(next.calorie).toBeUndefined();
    expect(next.steps).toBeUndefined();
  });
  it('never touches the step allowances the user put on days', () => {
    expect(applyRebalanceChoice(base, { kind: 'keep' }).stepAllowance).toEqual({ '2026-10-08': 100 });
    expect(applyRebalanceChoice(base, { kind: 'taper', reductionKcal: 50, fromDate: '2026-10-09' }).stepAllowance).toEqual({ '2026-10-08': 100 });
  });
});
