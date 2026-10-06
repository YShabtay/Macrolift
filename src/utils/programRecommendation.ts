import type { TrainingDaysPerWeek, TrainingLocation, WorkoutSplitType } from '../types/fitness';

export interface ProgramRecommendation {
  split: WorkoutSplitType;
  days: TrainingDaysPerWeek;
  reason: string;
}

/** Science-based suggestion for a weekly training frequency (frequency/volume evidence is summarized in data/workoutTemplates.ts). */
export function recommendProgram(daysPerWeek: TrainingDaysPerWeek, location: TrainingLocation = 'gym'): ProgramRecommendation {
  // Home programs stop at four days (upper/lower): without a gym's equipment extra days add little and cut into recovery.
  if (location === 'home' && daysPerWeek >= 4) {
    return {
      split: 'upper_lower',
      days: 4,
      reason: 'בבית, ארבעה אימונים בשבוע בפיצול עליון / תחתון נותנים לכל שריר שני גירויים בשבוע עם התאוששות מלאה. מעבר לזה אין הרבה תועלת בלי ציוד.',
    };
  }
  if (daysPerWeek <= 3) {
    return {
      split: 'fbw',
      days: daysPerWeek,
      reason: 'עם 2-3 אימונים בשבוע, גוף מלא מאפשר לכל שריר לקבל גירוי יותר מפעם בשבוע, וזו הפריסה היעילה ביותר לגירוי ולהתאוששות.',
    };
  }
  if (daysPerWeek === 4) {
    return {
      split: 'upper_lower',
      days: 4,
      reason: 'ארבעה ימים מתחלקים בצורה מושלמת לפיצול AB: שני גירויים שבועיים לכל שריר, עם יום התאוששות בין אימוני אותו האזור.',
    };
  }
  return {
    split: 'ppl',
    days: daysPerWeek,
    reason: 'עם 5-6 ימים, פיצול דחיפה/משיכה/רגליים נותן נפח שבועי גבוה לכל שריר בלי להעמיס על אותה קבוצה יום אחרי יום.',
  };
}
