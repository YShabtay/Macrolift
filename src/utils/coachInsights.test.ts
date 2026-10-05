import { describe, expect, it } from 'vitest';
import type { Goal, SetProgressEntry, WeightLog, WorkoutPlan } from '../types/fitness';
import { getWeeklyCoachInsight } from './coachInsights';
import { todayIso } from './weightCalculations';

const emptyPlan = { id: 'p', days: [] } as unknown as WorkoutPlan;

/** Three weigh-ins (Sun, Mon, Tue) of the week starting `weekStart`, all at `kg`. */
function week(weekStart: string, kg: number, count = 3): WeightLog[] {
  const day = Number(weekStart.slice(-2));
  return Array.from({ length: count }, (_, i) => {
    const date = `${weekStart.slice(0, 8)}${String(day + i).padStart(2, '0')}`;
    return { id: date, date, weightKg: kg };
  });
}

const W1 = '2026-09-13';
const W2 = '2026-09-20';
const W3 = '2026-09-27';

function insight(goal: Goal, weightLogs: WeightLog[]) {
  return getWeeklyCoachInsight({ goal, weightLogs, workoutPlan: emptyPlan, progress: [] });
}

describe('weekly coach insight: weight trend', () => {
  it('falls back to a generic note until there are two weeks of data', () => {
    expect(insight('gain_muscle', week(W1, 70)).emoji).toBe('💡');
    expect(insight('gain_muscle', []).emoji).toBe('💡');
  });

  it('does not judge a week with fewer than 3 weigh-ins (no scary warnings from noise)', () => {
    const result = insight('gain_muscle', [...week(W1, 70), ...week(W2, 71, 2)]);
    expect(result.emoji).toBe('📊');
    expect(result.message).not.toMatch(/⚠|קצת מהר/);
  });

  it('also refuses to judge when the earlier week is the thin one', () => {
    expect(insight('lose_weight', [...week(W1, 70, 2), ...week(W2, 69)]).emoji).toBe('📊');
  });

  it('praises a clean gain of 0.15-0.35 kg/week on a bulk', () => {
    const result = insight('gain_muscle', [...week(W1, 70), ...week(W2, 70.2)]);
    expect(result.emoji).toBe('📈');
    expect(result.message).toContain('0.2');
  });

  it('flags a fast gain (> 0.5 kg) only softly', () => {
    const result = insight('gain_muscle', [...week(W1, 70), ...week(W2, 70.8)]);
    expect(result.message).toContain('קצת מהר');
    expect(result.message).toContain('לא סיבה לדאגה');
    expect(result.message).not.toContain('⚠');
  });

  it('suggests more calories after two flat weeks on a bulk', () => {
    const result = insight('gain_muscle', [...week(W1, 70), ...week(W2, 70), ...week(W3, 70)]);
    expect(result.emoji).toBe('⏸️');
  });

  it('praises a healthy loss of 0.4-1.0 kg/week when cutting', () => {
    const result = insight('lose_weight', [...week(W1, 80), ...week(W2, 79.4)]);
    expect(result.emoji).toBe('📉');
  });

  it('calls a stable week good news for maintenance and recomp goals', () => {
    expect(insight('maintain', [...week(W1, 70), ...week(W2, 70.1)]).emoji).toBe('⚖️');
    expect(insight('recomp', [...week(W1, 70), ...week(W2, 70)]).emoji).toBe('⚖️');
  });
});

describe('weekly coach insight: strength win', () => {
  const plan = {
    id: 'p',
    days: [
      {
        id: 'd1',
        exercises: [
          { id: 'squat', name: 'סקוואט מוט', equipment: 'barbell', repsRange: '6-8', sets: 4, muscleGroup: 'quads' },
          { id: 'curl', name: 'כפיפת מרפק', equipment: 'dumbbell', repsRange: '10-12', sets: 3, muscleGroup: 'biceps' },
        ],
      },
    ],
  } as unknown as WorkoutPlan;

  const progress = (exerciseId: string, completedSets: number): SetProgressEntry[] =>
    [{ date: todayIso(), dayId: 'd1', exerciseId, completedSets }] as unknown as SetProgressEntry[];

  it("calls out a heavy barbell lift finished in full today, ahead of any weight insight", () => {
    const result = getWeeklyCoachInsight({ goal: 'maintain', weightLogs: [], workoutPlan: plan, progress: progress('squat', 4) });
    expect(result.emoji).toBe('💪');
    expect(result.message).toContain('סקוואט מוט');
  });

  it('ignores partially completed sets and light/accessory lifts', () => {
    expect(getWeeklyCoachInsight({ goal: 'maintain', weightLogs: [], workoutPlan: plan, progress: progress('squat', 3) }).emoji).toBe('💡');
    expect(getWeeklyCoachInsight({ goal: 'maintain', weightLogs: [], workoutPlan: plan, progress: progress('curl', 3) }).emoji).toBe('💡');
  });
});
