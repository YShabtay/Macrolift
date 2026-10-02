import { useState } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import type { TrainingDaysPerWeek, UserMetrics, WorkoutSplitType } from '../types/fitness';
import { ThemeToggleSetting } from './ThemeToggle';
import ProgramSwitcherModal from './ProgramSwitcherModal';
import { recommendProgram, type ProgramRecommendation } from '../utils/programRecommendation';

const TRAINING_DAYS_OPTIONS: TrainingDaysPerWeek[] = [2, 3, 4, 5, 6];

const SPLIT_LABELS: Record<WorkoutSplitType, string> = {
  fbw: 'Full Body (FBW)',
  upper_lower: 'Upper / Lower',
  ppl: 'Push / Pull / Legs',
};

interface SettingsProps {
  metrics: UserMetrics;
  currentSplit: WorkoutSplitType;
  onApplyProgram: (split: WorkoutSplitType, days: TrainingDaysPerWeek) => void;
}

export default function Settings({ metrics, currentSplit, onApplyProgram }: SettingsProps) {
  const [selectedDays, setSelectedDays] = useState<TrainingDaysPerWeek>(metrics.trainingDaysPerWeek);
  const [justSaved, setJustSaved] = useState(false);
  const [recommendation, setRecommendation] = useState<ProgramRecommendation | null>(null);

  // metrics.trainingDaysPerWeek can change from outside this component (profile edit, data import) - stay in
  // sync without an effect, per React's "adjusting state when a prop changes" pattern.
  const [syncedDays, setSyncedDays] = useState(metrics.trainingDaysPerWeek);
  if (metrics.trainingDaysPerWeek !== syncedDays) {
    setSyncedDays(metrics.trainingDaysPerWeek);
    setSelectedDays(metrics.trainingDaysPerWeek);
  }

  const hasChanged = selectedDays !== metrics.trainingDaysPerWeek;
  const suggested = recommendProgram(selectedDays);
  const newSplit = suggested.split;

  function flashSaved() {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  }

  function handleSave() {
    // A different frequency usually calls for a different program: show the evidence-based suggestion and let the user confirm
    // it or pick another. Same program, new frequency (e.g. 5 -> 6 PPL days) just applies.
    if (suggested.split !== currentSplit) {
      setRecommendation(suggested);
      return;
    }
    onApplyProgram(currentSplit, selectedDays);
    flashSaved();
  }

  return (
    <div className="flex flex-col gap-4">
      <ThemeToggleSetting />

      <div className="glass-card p-5 sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">עדכון זמינות ותוכנית אימונים</h2>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
          שינוי ימי האימון השבועיים יבנה מיד תוכנית אימון מחדש (כולל כל ההתאמות האישיות שלך), ויעדכן את חישוב ה-TDEE
          ויעד הקלוריות בהתאם לתדירות החדשה.
        </p>

        <div className="mb-4 grid grid-cols-5 gap-2">
          {TRAINING_DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDays(d)}
              className={`rounded-xl border py-3 text-lg font-bold transition ${
                selectedDays === d
                  ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                  : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {hasChanged && (
          <div className="mb-4 rounded-xl border border-lime-400/20 bg-lime-400/5 p-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 animate-fade-in">
            עם {selectedDays} ימים בשבוע נמליץ על <span className="font-bold text-lime-700 dark:text-lime-400">{SPLIT_LABELS[newSplit]}</span>
            . תוכלו לאשר או לבחור תוכנית אחרת, ויעד הקלוריות יחושב מחדש בהתאם.
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanged}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {justSaved ? (
            <>
              <Check className="h-4 w-4" />
              התוכנית עודכנה!
            </>
          ) : (
            'שמירה ועדכון תוכנית'
          )}
        </button>
      </div>

      {recommendation && (
        <ProgramSwitcherModal
          currentSplit={currentSplit}
          currentDays={metrics.trainingDaysPerWeek}
          recommendation={recommendation}
          onApply={(split, days) => {
            onApplyProgram(split, days);
            flashSaved();
          }}
          onClose={() => setRecommendation(null)}
        />
      )}
    </div>
  );
}
