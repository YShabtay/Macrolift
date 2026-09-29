import type { Exercise, Goal, SetProgressEntry, WeightLog, WorkoutPlan } from '../types/fitness';
import { buildWeeklySummaries, todayIso } from './weightCalculations';

export interface CoachInsight {
  emoji: string;
  message: string;
}

const FALLBACK_INSIGHT: CoachInsight = {
  emoji: '💡',
  message: 'ממשיכים לאסוף נתונים - שקילה עקבית ומעקב אחרי האימונים יעזרו לנו לתת לך תובנות מדויקות יותר.',
};

function minReps(repsRange: string): number {
  const match = repsRange.match(/\d+/);
  return match ? Number(match[0]) : 99;
}

/** Finds a heavy compound lift completed in full today, worth calling out for progressive overload. */
function findTodayCompletedStrengthExercise(
  workoutPlan: WorkoutPlan,
  progress: SetProgressEntry[],
): Exercise | null {
  const today = todayIso();
  for (const entry of progress) {
    if (entry.date !== today) continue;
    const day = workoutPlan.days.find((d) => d.id === entry.dayId);
    const exercise = day?.exercises.find((e) => e.id === entry.exerciseId);
    if (!exercise || entry.completedSets < exercise.sets) continue;
    if (exercise.equipment === 'barbell' && minReps(exercise.repsRange) <= 8) {
      return exercise;
    }
  }
  return null;
}

function getWeightTrendInsight(goal: Goal, weightLogs: WeightLog[]): CoachInsight | null {
  const summaries = buildWeeklySummaries(weightLogs);
  if (summaries.length < 2) return null;

  const last = summaries[summaries.length - 1];
  const prev = summaries[summaries.length - 2];
  const delta = Math.round((last.averageKg - prev.averageKg) * 10) / 10;

  const isPlateaued = (() => {
    if (summaries.length < 3 || Math.abs(delta) >= 0.1) return false;
    const prev2 = summaries[summaries.length - 3];
    const deltaPrev = prev.averageKg - prev2.averageKg;
    return Math.abs(deltaPrev) < 0.1;
  })();

  if (goal === 'gain_muscle') {
    if (delta >= 0.15 && delta <= 0.35) {
      return { emoji: '📈', message: `קצב מסה נקי ומעולה - עלית ${delta.toFixed(1)} ק״ג השבוע. שמור/י על אותם ערכים!` };
    }
    if (isPlateaued) {
      return {
        emoji: '⏸️',
        message: 'פלאטו בעלייה - המשקל כמעט לא זז כבר שבועיים. מומלץ להעלות כ-150 קלוריות (בעיקר פחמימה סביב האימון).',
      };
    }
    if (delta > 0.35) {
      return {
        emoji: '⚠️',
        message: `עלית ${delta.toFixed(1)} ק״ג השבוע - קצב מהיר מהרצוי למסה נקייה. שקול/י להוריד מעט קלוריות כדי לצמצם עודף שומן.`,
      };
    }
  }

  if (goal === 'lose_weight') {
    if (delta <= -0.4 && delta >= -1.0) {
      return { emoji: '📉', message: `ירדת ${Math.abs(delta).toFixed(1)} ק״ג השבוע - קצב בריא ומעולה. המשך/י כך!` };
    }
    if (isPlateaued) {
      return {
        emoji: '⏸️',
        message: 'פלאטו בירידה - המשקל כמעט לא זז כבר שבועיים. שקול/י להפחית כ-100-150 קלוריות או להוסיף פעילות יומית.',
      };
    }
  }

  if ((goal === 'maintain' || goal === 'recomp') && Math.abs(delta) < 0.2) {
    return { emoji: '⚖️', message: 'המשקל יציב השבוע - בדיוק כמו שצריך למטרה שלך. כל הכבוד על העקביות!' };
  }

  return null;
}

/**
 * Picks the single most relevant coaching insight for the week: an immediate
 * "you just crushed that lift" callout takes priority, then a goal-aware
 * weight-trend read, falling back to a generic encouragement.
 */
export function getWeeklyCoachInsight(params: {
  goal: Goal;
  weightLogs: WeightLog[];
  workoutPlan: WorkoutPlan;
  progress: SetProgressEntry[];
}): CoachInsight {
  const strengthWin = findTodayCompletedStrengthExercise(params.workoutPlan, params.progress);
  if (strengthWin) {
    return {
      emoji: '💪',
      message: `סיימת את כל הסטים ב"${strengthWin.name}" בהצלחה! באימון הבא נסה/י להוסיף 2.5 ק״ג למוט.`,
    };
  }

  return getWeightTrendInsight(params.goal, params.weightLogs) ?? FALLBACK_INSIGHT;
}
