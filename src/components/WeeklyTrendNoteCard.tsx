import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { FoodEntry, NutritionPlan, UserMetrics, WeightLog } from '../types/fitness';
import { checkTarget, getCheckStart } from '../utils/targetCheck';
import { describeTrendNote, getWeeklyTrendNote } from '../utils/weeklyTrendNote';
import { calculateNutritionPlan } from '../utils/calculations';
import { daysBetween } from '../utils/weightCalculations';
import { useToday } from '../hooks/useToday';

const SNOOZE_KEY = 'macrolift-weekly-trend-snoozed';
const SNOOZE_DAYS = 7;

function readSnoozed(): string | null {
  try {
    return localStorage.getItem(SNOOZE_KEY);
  } catch {
    return null;
  }
}

interface WeeklyTrendNoteCardProps {
  weightLogs: WeightLog[];
  foodLog: FoodEntry[];
  metrics: UserMetrics;
  profileCreatedAt: string;
  nutritionPlan: NutritionPlan;
  /** Adds this many kcal to the daily target (negative removes); the range, macros and everything built on them follow. */
  onApply: (deltaKcal: number) => void;
}

/**
 * A short memory of the last three or four weekly averages. When they all move the wrong way for the goal (a bulk that is not rising, a cut that is not
 * falling, a week-after-week drift on maintenance) it says so and suggests a calorie change, which can be applied in one tap. It stays out of the way
 * when the regular trend check already has a suggestion on screen, so the same advice is never given twice.
 */
export default function WeeklyTrendNoteCard({ weightLogs, foodLog, metrics, profileCreatedAt, nutritionPlan, onApply }: WeeklyTrendNoteCardProps) {
  const today = useToday();
  const [snoozedOn, setSnoozedOn] = useState(readSnoozed);
  const since = getCheckStart(metrics, profileCreatedAt);

  const note = useMemo(
    () => getWeeklyTrendNote({ weightLogs, goal: metrics.goal, intensity: metrics.goalIntensity, weightKg: metrics.weightKg, today, since }),
    [weightLogs, metrics.goal, metrics.goalIntensity, metrics.weightKg, today, since],
  );
  const regularCheck = useMemo(
    () => checkTarget({ weightLogs, foodLog, goal: metrics.goal, intensity: metrics.goalIntensity, weightKg: metrics.weightKg, targetCalories: nutritionPlan.targetCalories, since, today }),
    [weightLogs, foodLog, metrics.goal, metrics.goalIntensity, metrics.weightKg, nutritionPlan.targetCalories, since, today],
  );
  const preview = useMemo(
    () => (note ? calculateNutritionPlan({ ...metrics, targetAdjustmentKcal: (metrics.targetAdjustmentKcal ?? 0) + note.suggestedDeltaKcal }) : null),
    [metrics, note],
  );

  if (!note || !preview) return null;
  if (regularCheck.status === 'ready' && (regularCheck.verdict === 'add' || regularCheck.verdict === 'reduce')) return null;
  if (snoozedOn !== null && daysBetween(snoozedOn, today) < SNOOZE_DAYS) return null;

  const Icon = note.eatMore ? TrendingUp : TrendingDown;
  const kcal = Math.abs(note.suggestedDeltaKcal);

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, today);
    } catch {
      // Storage blocked: the note simply shows again next time.
    }
    setSnoozedOn(today);
  }

  return (
    <div className="glass-card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-lime-700 dark:text-lime-400" />
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{describeTrendNote(note)}</h3>
      </div>
      <p className="text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200" dir="ltr">
        {note.weeks.map((w) => w.averageKg).join(' → ')} <span className="text-xs font-normal text-zinc-500">ק״ג</span>
      </p>
      <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
        {note.eatMore ? 'כדאי להוסיף' : 'כדאי להוריד'} כ-{kcal} קק״ל ליום: היעד יהיה {preview.targetCalories.toLocaleString('he-IL')} קק״ל. אחרי השינוי הבדיקה מתחילה מחדש, ושווה לחכות כמה שבועות לפני שמשנים שוב.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onApply(note.suggestedDeltaKcal)} className="btn-primary text-xs">
          {note.eatMore ? `הוסף ${kcal} קק״ל` : `הורד ${kcal} קק״ל`}
        </button>
        <button type="button" onClick={snooze} className="btn-secondary text-xs">
          לא עכשיו
        </button>
      </div>
    </div>
  );
}
