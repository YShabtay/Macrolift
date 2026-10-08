import { useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import type { NutritionPlan, UserMetrics, WeightLog } from '../types/fitness';
import { calculateNutritionPlan } from '../utils/calculations';
import { WEIGHT_SYNC_SNOOZE_DAYS, getWeightSyncSuggestion } from '../utils/profileWeightSync';
import { daysBetween } from '../utils/weightCalculations';
import { useToday } from '../hooks/useToday';

const SNOOZE_KEY = 'macrolift-weight-sync-snoozed';

function readSnoozed(): string | null {
  try {
    return localStorage.getItem(SNOOZE_KEY);
  } catch {
    return null;
  }
}

interface ProfileWeightSyncCardProps {
  metrics: UserMetrics;
  weightLogs: WeightLog[];
  nutritionPlan: NutritionPlan;
  /** Sets the profile weight; the calorie target, macros and everything built on them are recalculated. */
  onApply: (weightKg: number) => void;
}

/** Offers to bring the profile weight in line with the weekly averages when they have moved a few kilos away from it. */
export default function ProfileWeightSyncCard({ metrics, weightLogs, nutritionPlan, onApply }: ProfileWeightSyncCardProps) {
  const today = useToday();
  const [snoozedOn, setSnoozedOn] = useState(readSnoozed);
  const suggestion = useMemo(() => getWeightSyncSuggestion({ metrics, weightLogs, today }), [metrics, weightLogs, today]);
  const preview = useMemo(
    () => (suggestion ? calculateNutritionPlan({ ...metrics, weightKg: suggestion.suggestedKg }) : null),
    [metrics, suggestion],
  );

  if (!suggestion || !preview) return null;
  if (snoozedOn !== null && daysBetween(snoozedOn, today) < WEIGHT_SYNC_SNOOZE_DAYS) return null;

  const deltaKcal = preview.targetCalories - nutritionPlan.targetCalories;
  const kg = (n: number) => n.toLocaleString('he-IL', { maximumFractionDigits: 1 });

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, today);
    } catch {
      // Storage blocked: the suggestion simply shows again next time.
    }
    setSnoozedOn(today);
  }

  return (
    <div className="glass-card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-lime-700 dark:text-lime-400" />
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">לעדכן את משקל הפרופיל?</h3>
      </div>
      <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
        הממוצע השבועי שלך בשבועיים האחרונים הוא כ-{kg(suggestion.suggestedKg)} ק״ג, והפרופיל עדיין על {kg(suggestion.profileKg)} ק״ג. היעד הקלורי, החלבון והקלוריות מהצעדים
        מחושבים לפי משקל הפרופיל, אז עדכון יתאים אותם אליך
        {Math.abs(deltaKcal) >= 5 ? `: היעד ${deltaKcal > 0 ? 'יעלה' : 'ירד'} בכ-${Math.abs(deltaKcal)} קק״ל, ל-${preview.targetCalories.toLocaleString('he-IL')}` : ''}.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onApply(suggestion.suggestedKg)} className="btn-primary text-xs">
          עדכון ל-{kg(suggestion.suggestedKg)} ק״ג
        </button>
        <button type="button" onClick={snooze} className="btn-secondary text-xs">
          לא עכשיו
        </button>
      </div>
    </div>
  );
}
