import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Save, X } from 'lucide-react';
import type { ExerciseDifficulty, Goal, GoalIntensity, HomeEquipment, TargetFocus, TrainingDaysPerWeek, TrainingLocation, UserMetrics } from '../types/fitness';
import BulkingPlanEditor from './BulkingPlanEditor';
import TargetFocusPicker from './TargetFocusPicker';
import TrainingSetupPicker from './TrainingSetupPicker';
import { draftFromPlan, parseBulkingDraft } from '../utils/bulkingPlan';

const AGE_MIN = 14;
const AGE_MAX = 99;
const HEIGHT_MIN = 120;
const HEIGHT_MAX = 230;
const WEIGHT_MIN = 35;
const WEIGHT_MAX = 250;
const STEPS_MIN = 1000;
const STEPS_MAX = 50000;

const TRAINING_DAYS_OPTIONS: TrainingDaysPerWeek[] = [2, 3, 4, 5, 6];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'lose_weight', label: 'חיטוב' },
  { value: 'maintain', label: 'שמירה' },
  { value: 'gain_muscle', label: 'מסה מבוקרת' },
  { value: 'recomp', label: 'שיפור הרכב גוף' },
];

const GOAL_INTENSITY_OPTIONS: { value: GoalIntensity; label: string }[] = [
  { value: 'moderate', label: 'מתון' },
  { value: 'aggressive', label: 'אגרסיבי' },
];

interface EditProfileModalProps {
  metrics: UserMetrics;
  onSave: (updates: Partial<UserMetrics>) => void;
  onClose: () => void;
}

export default function EditProfileModal({ metrics, onSave, onClose }: EditProfileModalProps) {
  const [gender, setGender] = useState(metrics.gender);
  const [age, setAge] = useState(String(metrics.age));
  const [heightCm, setHeightCm] = useState(String(metrics.heightCm));
  const [weightKg, setWeightKg] = useState(String(metrics.weightKg));
  const [averageDailySteps, setAverageDailySteps] = useState(String(metrics.averageDailySteps));
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<TrainingDaysPerWeek>(metrics.trainingDaysPerWeek);
  const [targetFocus, setTargetFocus] = useState<TargetFocus>(metrics.targetFocus ?? 'balanced');
  const [setup, setSetup] = useState({
    location: (metrics.trainingLocation ?? 'gym') as TrainingLocation,
    equipment: (metrics.trainingLocation === 'home' ? (metrics.homeEquipment ?? 'none') : null) as HomeEquipment | null,
    level: (metrics.trainingLocation === 'home' ? (metrics.homeLevel ?? 'beginner') : null) as ExerciseDifficulty | null,
  });
  const [goal, setGoal] = useState<Goal>(metrics.goal);
  const [goalIntensity, setGoalIntensity] = useState<GoalIntensity>(metrics.goalIntensity ?? 'moderate');
  const [bulkingDraft, setBulkingDraft] = useState(() => draftFromPlan(metrics.bulkingPlan));

  const ageValue = Number(age);
  const heightValue = Number(heightCm);
  const weightValue = Number(weightKg);
  const stepsValue = Number(averageDailySteps);

  const isAgeValid = age.trim() !== '' && !Number.isNaN(ageValue) && ageValue >= AGE_MIN && ageValue <= AGE_MAX;
  const isHeightValid =
    heightCm.trim() !== '' && !Number.isNaN(heightValue) && heightValue >= HEIGHT_MIN && heightValue <= HEIGHT_MAX;
  const isWeightValid =
    weightKg.trim() !== '' && !Number.isNaN(weightValue) && weightValue >= WEIGHT_MIN && weightValue <= WEIGHT_MAX;
  const isStepsValid =
    averageDailySteps.trim() !== '' &&
    !Number.isNaN(stepsValue) &&
    stepsValue >= STEPS_MIN &&
    stepsValue <= STEPS_MAX;

  const bulkingResult = parseBulkingDraft(bulkingDraft, metrics.bulkingPlan);
  const isBulkingValid = goal !== 'gain_muscle' || bulkingResult.status !== 'invalid';

  const isValid = isAgeValid && isHeightValid && isWeightValid && isStepsValid && isBulkingValid;

  function handleSave() {
    if (!isValid) return;
    onSave({
      gender,
      age: ageValue,
      heightCm: heightValue,
      weightKg: weightValue,
      averageDailySteps: stepsValue,
      trainingDaysPerWeek,
      targetFocus,
      trainingLocation: setup.location,
      homeEquipment: setup.location === 'home' ? (setup.equipment ?? 'none') : undefined,
      homeLevel: setup.location === 'home' ? (setup.level ?? 'beginner') : undefined,
      goal,
      goalIntensity: goal === 'gain_muscle' ? goalIntensity : undefined,
      bulkingPlan: goal === 'gain_muscle' && bulkingResult.status === 'ok' ? bulkingResult.plan : undefined,
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">עריכת פרטים</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">מין</label>
            <div className="grid grid-cols-2 gap-2">
              {(['male', 'female'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                    gender === g
                      ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {g === 'male' ? 'זכר' : 'נקבה'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="גיל (שנים)"
              value={age}
              onChange={setAge}
              min={AGE_MIN}
              max={AGE_MAX}
              isValid={isAgeValid}
            />
            <NumberField
              label="גובה (ס״מ)"
              value={heightCm}
              onChange={setHeightCm}
              min={HEIGHT_MIN}
              max={HEIGHT_MAX}
              isValid={isHeightValid}
            />
            <NumberField
              label="משקל עדכני (ק״ג)"
              value={weightKg}
              onChange={setWeightKg}
              min={WEIGHT_MIN}
              max={WEIGHT_MAX}
              isValid={isWeightValid}
            />
            <NumberField
              label="ממוצע צעדים יומי"
              value={averageDailySteps}
              onChange={setAverageDailySteps}
              min={STEPS_MIN}
              max={STEPS_MAX}
              isValid={isStepsValid}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">ימי אימון בשבוע</label>
            <div className="grid grid-cols-5 gap-2">
              {TRAINING_DAYS_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTrainingDaysPerWeek(d)}
                  className={`rounded-xl border py-2.5 text-sm font-bold transition ${
                    trainingDaysPerWeek === d
                      ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <TrainingSetupPicker
            value={setup}
            onChange={(next) =>
              setSetup({
                location: next.location ?? 'gym',
                equipment: next.location === 'home' ? (next.equipment ?? 'none') : null,
                level: next.location === 'home' ? (next.level ?? 'beginner') : null,
              })
            }
          />
          {((setup.location === 'home') !== (metrics.trainingLocation === 'home') ||
            (setup.location === 'home' && (setup.equipment !== (metrics.homeEquipment ?? 'none') || setup.level !== (metrics.homeLevel ?? 'beginner')))) && (
            <p className="-mt-2 text-[11px] leading-relaxed text-orange-700 dark:text-orange-400">
              שינוי מקום האימון, הציוד או הרמה יבנה תוכנית אימונים חדשה (אימונים שכבר סימנת כהושלמו יישמרו).
            </p>
          )}

          <TargetFocusPicker value={targetFocus} onChange={setTargetFocus} compact />
          {targetFocus !== (metrics.targetFocus ?? 'balanced') && (
            <p className="-mt-2 text-[11px] leading-relaxed text-orange-700 dark:text-orange-400">
              שינוי המיקוד יבנה מחדש את תוכנית האימונים הנוכחית (אימונים שכבר סימנת כהושלמו יישמרו).
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">מטרה ראשית</label>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGoal(value)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                    goal === value
                      ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {goal === 'gain_muscle' && (
            <div className="animate-fade-in">
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">קצב</label>
              <div className="grid grid-cols-2 gap-2">
                {GOAL_INTENSITY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGoalIntensity(value)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                      goalIntensity === value
                        ? 'border-orange-400/50 bg-orange-400/10 text-orange-700 dark:text-orange-400'
                        : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {goal === 'gain_muscle' && (
            <BulkingPlanEditor
              draft={bulkingDraft}
              onChange={setBulkingDraft}
              experienceYears={metrics.experience?.experienceYears}
            />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValid}
              className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              שמור שינויים
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  isValid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  isValid: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:ring-2 ${
          isValid
            ? 'border-zinc-300 dark:border-zinc-700 focus:border-lime-400 focus:ring-lime-400/20'
            : 'border-orange-400/60 focus:border-orange-400 focus:ring-orange-400/20'
        }`}
      />
      {!isValid && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-orange-700 dark:text-orange-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          ערך בין {min} ל-{max}
        </p>
      )}
    </div>
  );
}
