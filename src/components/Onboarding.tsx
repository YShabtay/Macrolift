import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Dumbbell,
  Flame,
  Footprints,
  Layers,
  RefreshCw,
  Ruler,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  User,
  Weight,
} from 'lucide-react';
import type {
  BodyMeasurements,
  CurrentSplit,
  ExperienceProfile,
  FocusArea,
  Goal,
  GoalIntensity,
  InjuryArea,
  TrainingDaysPerWeek,
  TrainingExperience,
  UserMetrics,
  UserProfile,
} from '../types/fitness';
import { calculateNutritionPlan } from '../utils/calculations';
import { getWorkoutTemplate, suggestSplitType } from '../data/workoutTemplates';
import { adaptWorkoutPlan } from '../utils/workoutAdaptation';
import { BODY_TYPE_OPTIONS } from '../data/bodyTypes';
import InfoTooltip from './InfoTooltip';
import MedicalDisclaimerModal from './MedicalDisclaimerModal';
import type { NutritionPlan, WorkoutPlan } from '../types/fitness';

// ---------------------------------------------------------------------------
// Static option config
// ---------------------------------------------------------------------------

const MEASUREMENT_INFO: Record<string, { title: string; text: string }> = {
  waistCm: {
    title: 'היקף מותן/טבור',
    text: 'מדוד/י עם סרט מדידה בקו הטבור, לאחר נשיפה טבעית וללא הכנסת הבטן. עמוד/י זקוף/ה במצב נינוח.',
  },
  armCm: {
    title: 'היקף זרוע',
    text: 'מדוד/י באמצע הזרוע (בין הכתף למרפק) כשהיא רפויה לצדך, ללא כיווץ השריר.',
  },
  chestCm: {
    title: 'היקף חזה',
    text: 'מדוד/י בנקודה הרחבה ביותר של בית החזה, מתחת לבתי השחי, בנשימה רגילה.',
  },
  hipCm: {
    title: 'היקף ירך/אגן',
    text: 'מדוד/י בנקודה הרחבה ביותר של הישבן והירכיים, כשהרגליים צמודות.',
  },
};

const GOAL_OPTIONS: {
  value: Goal;
  label: string;
  description: string;
  icon: typeof User;
}[] = [
  { value: 'lose_weight', label: 'ירידה במשקל', description: 'גירעון קלורי לירידה בשומן', icon: TrendingDown },
  { value: 'maintain', label: 'שמירה על המשקל', description: 'איזון קלורי, שיפור הרגלים', icon: Scale },
  { value: 'gain_muscle', label: 'מסה מבוקרת (Lean Bulk)', description: 'עודף קלורי מבוקר לבניית שריר עם מינימום שומן', icon: Dumbbell },
  { value: 'recomp', label: 'שיפור הרכב גוף', description: 'ירידה בשומן ועלייה בשריר יחד', icon: RefreshCw },
];

const GOAL_INTENSITY_OPTIONS: { value: GoalIntensity; label: string; description: string }[] = [
  { value: 'moderate', label: 'מתונה / מבוקרת', description: '150-200 קק״ל עודף (~8% מה-TDEE)' },
  { value: 'aggressive', label: 'אגרסיבית', description: '300-400 קק״ל עודף' },
];

const TRAINING_DAYS_OPTIONS: TrainingDaysPerWeek[] = [2, 3, 4, 5, 6];

const EXPERIENCE_YEARS_OPTIONS: { value: TrainingExperience; label: string }[] = [
  { value: 'under_1y', label: 'פחות משנה' },
  { value: '1_3y', label: '1-3 שנים' },
  { value: 'over_3y', label: 'מעל 3 שנים' },
];

const CURRENT_SPLIT_OPTIONS: { value: CurrentSplit; label: string }[] = [
  { value: 'fbw', label: 'Full Body (FBW)' },
  { value: 'upper_lower', label: 'Upper / Lower' },
  { value: 'ppl', label: 'Push / Pull / Legs' },
  { value: 'custom', label: 'תוכנית אישית' },
];

const FOCUS_AREA_OPTIONS: { value: FocusArea; label: string }[] = [
  { value: 'upper_chest', label: 'חזה עליון' },
  { value: 'back_width', label: 'גב ורוחב' },
  { value: 'shoulders', label: 'כתפיים' },
  { value: 'legs_glutes', label: 'רגליים/ישבן' },
  { value: 'arms', label: 'זרועות' },
];

const INJURY_OPTIONS: { value: InjuryArea; label: string }[] = [
  { value: 'shoulder', label: 'כתף' },
  { value: 'lower_back', label: 'גב תחתון' },
  { value: 'knees', label: 'ברכיים' },
];

const TOTAL_STEPS = 6;

interface OnboardingProps {
  onComplete: (profile: UserProfile, nutritionPlan: NutritionPlan, workoutPlan: WorkoutPlan) => void;
}

interface FormState {
  name: string;
  gender: 'male' | 'female';
  age: string;
  heightCm: string;
  weightKg: string;
  averageDailySteps: string;
  trainingDaysPerWeek: TrainingDaysPerWeek;
  bodyState: UserMetrics['bodyState'] | null;
  goal: Goal | null;
  goalIntensity: GoalIntensity;
  waistCm: string;
  armCm: string;
  chestCm: string;
  hipCm: string;
  isCurrentlyTraining: boolean | null;
  experienceYears: TrainingExperience | null;
  currentSplit: CurrentSplit | null;
  focusAreas: FocusArea[];
  hasPlateau: boolean | null;
  injuries: InjuryArea[];
  injuryNotes: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  gender: 'male',
  age: '',
  heightCm: '',
  weightKg: '',
  averageDailySteps: '8000',
  trainingDaysPerWeek: 3,
  bodyState: null,
  goal: null,
  goalIntensity: 'moderate',
  waistCm: '',
  armCm: '',
  chestCm: '',
  hipCm: '',
  isCurrentlyTraining: null,
  experienceYears: null,
  currentSplit: null,
  focusAreas: [],
  hasPlateau: null,
  injuries: [],
  injuryNotes: '',
};

const MEASUREMENT_RANGE: [number, number] = [15, 200];

function isValidOptionalMeasurement(value: string): boolean {
  if (value.trim() === '') return true;
  const num = Number(value);
  return !Number.isNaN(num) && num >= MEASUREMENT_RANGE[0] && num <= MEASUREMENT_RANGE[1];
}

function buildMeasurements(form: FormState): BodyMeasurements | undefined {
  const raw: [keyof BodyMeasurements, string][] = [
    ['waistCm', form.waistCm],
    ['armCm', form.armCm],
    ['chestCm', form.chestCm],
    ['hipCm', form.hipCm],
  ];
  const result: BodyMeasurements = {};
  for (const [key, value] of raw) {
    const num = Number(value);
    if (value.trim() !== '' && !Number.isNaN(num) && num > 0) result[key] = num;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function buildExperienceProfile(form: FormState): ExperienceProfile | undefined {
  if (form.isCurrentlyTraining === null) return undefined;
  if (!form.isCurrentlyTraining) return { isCurrentlyTraining: false };
  return {
    isCurrentlyTraining: true,
    experienceYears: form.experienceYears ?? undefined,
    currentSplit: form.currentSplit ?? undefined,
    focusAreas: form.focusAreas.length > 0 ? form.focusAreas : undefined,
    hasPlateau: form.hasPlateau ?? undefined,
    injuries: form.injuries.length > 0 ? form.injuries : undefined,
    injuryNotes: form.injuryNotes.trim() || undefined,
  };
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return form.name.trim().length >= 2;
      case 1:
        return form.bodyState !== null;
      case 2:
        return form.goal !== null;
      case 3:
        return (
          Number(form.age) >= 14 &&
          Number(form.age) <= 99 &&
          Number(form.heightCm) >= 120 &&
          Number(form.heightCm) <= 230 &&
          Number(form.weightKg) >= 35 &&
          Number(form.weightKg) <= 250 &&
          Number(form.averageDailySteps) >= 1000 &&
          Number(form.averageDailySteps) <= 50000 &&
          isValidOptionalMeasurement(form.waistCm) &&
          isValidOptionalMeasurement(form.armCm) &&
          isValidOptionalMeasurement(form.chestCm) &&
          isValidOptionalMeasurement(form.hipCm)
        );
      case 4:
        return form.isCurrentlyTraining !== null;
      default:
        return true;
    }
  }, [step, form]);

  const metrics: UserMetrics | null = useMemo(() => {
    if (!form.bodyState || !form.goal) return null;
    if (step < 3) return null;
    return {
      gender: form.gender,
      age: Number(form.age),
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      averageDailySteps: Number(form.averageDailySteps),
      trainingDaysPerWeek: form.trainingDaysPerWeek,
      bodyState: form.bodyState,
      goal: form.goal,
      goalIntensity: form.goalIntensity,
      measurements: buildMeasurements(form),
      experience: buildExperienceProfile(form),
    };
  }, [form, step]);

  const nutritionPlan = useMemo(() => (metrics ? calculateNutritionPlan(metrics) : null), [metrics]);
  const workoutPlan = useMemo(() => {
    if (!metrics) return null;
    const split = suggestSplitType(metrics.trainingDaysPerWeek);
    const baseTemplate = getWorkoutTemplate(split, metrics.trainingDaysPerWeek);
    return adaptWorkoutPlan(baseTemplate, metrics.experience).plan;
  }, [metrics]);

  function goNext() {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  function handleFinish() {
    if (!metrics || !nutritionPlan || !workoutPlan) return;
    setIsDisclaimerOpen(true);
  }

  function handleConfirmDisclaimer() {
    if (!metrics || !nutritionPlan || !workoutPlan) return;
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      createdAt: new Date().toISOString(),
      metrics,
    };
    onComplete(profile, nutritionPlan, workoutPlan);
  }

  return (
    <div className="min-h-svh bg-zinc-50 dark:bg-zinc-950 px-4 py-8 text-zinc-900 dark:text-zinc-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <Header step={step} />

        <div key={step} className="animate-slide-up">
          {step === 0 && <StepName form={form} setForm={setForm} />}
          {step === 1 && <StepBodyState form={form} setForm={setForm} />}
          {step === 2 && <StepGoal form={form} setForm={setForm} />}
          {step === 3 && <StepMetrics form={form} setForm={setForm} />}
          {step === 4 && <StepExperience form={form} setForm={setForm} />}
          {step === 5 && metrics && nutritionPlan && workoutPlan && (
            <StepResults name={form.name} nutritionPlan={nutritionPlan} workoutPlan={workoutPlan} />
          )}
        </div>

        <Footer
          step={step}
          canProceed={canProceed}
          onBack={goBack}
          onNext={step === TOTAL_STEPS - 1 ? handleFinish : goNext}
        />
      </div>

      {isDisclaimerOpen && <MedicalDisclaimerModal onConfirm={handleConfirmDisclaimer} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header / progress
// ---------------------------------------------------------------------------

function Header({ step }: { step: number }) {
  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight text-lime-700 dark:text-lime-400">MacroLift</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-500">בניית פרופיל</span>
        </div>
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-500">
          שלב {step + 1} מתוך {TOTAL_STEPS}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-l from-lime-500 to-lime-400 shadow-glow transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 0: Name
// ---------------------------------------------------------------------------

function StepName({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="glass-card p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">ברוכים הבאים ל-MacroLift</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">בואו נכיר - איך קוראים לך?</p>
        </div>
      </div>
      <label className="mb-2 block text-sm font-medium text-zinc-600 dark:text-zinc-400">שם פרטי</label>
      <input
        autoFocus
        type="text"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="לדוגמה: יוגב"
        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Body state
// ---------------------------------------------------------------------------

function StepBodyState({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <SectionTitle title="מה מתאר הכי טוב את מצבך הנוכחי?" subtitle="זה יעזור לנו להתאים לך תוכנית מדויקת יותר" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {BODY_TYPE_OPTIONS.map(({ value, label, description, image }) => {
          const selected = form.bodyState === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, bodyState: value }))}
              className={`glass-card relative flex flex-row items-center gap-4 p-4 text-right transition sm:flex-col sm:text-center ${
                selected ? 'neon-border ring-1 ring-lime-400/40' : 'hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-zinc-900/60 p-1.5 sm:h-28 sm:w-20">
                <img src={image} alt={label} className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{label}</p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-500">{description}</p>
              </div>
              {selected && (
                <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-lime-400 text-zinc-950">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Goal
// ---------------------------------------------------------------------------

function StepGoal({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <SectionTitle title="מה המטרה העיקרית שלך?" subtitle="נחשב עבורך יעד קלורי ותפריט מאקרו בהתאם" />
      <div className="flex flex-col gap-3">
        {GOAL_OPTIONS.map(({ value, label, description, icon: Icon }) => {
          const selected = form.goal === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, goal: value }))}
              className={`glass-card flex items-center gap-4 p-4 text-right transition sm:p-5 ${
                selected ? 'neon-border ring-1 ring-lime-400/40' : 'hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition ${
                  selected ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{label}</p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-500">{description}</p>
              </div>
              {selected && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-400 text-zinc-950">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {form.goal === 'gain_muscle' && (
        <div className="mt-4 animate-fade-in">
          <p className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">קצב העלייה במסה</p>
          <div className="grid grid-cols-2 gap-3">
            {GOAL_INTENSITY_OPTIONS.map(({ value, label, description }) => {
              const selected = form.goalIntensity === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, goalIntensity: value }))}
                  className={`rounded-xl border p-3.5 text-right transition ${
                    selected
                      ? 'border-lime-400/50 bg-lime-400/10'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <p className={`text-sm font-bold ${selected ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-500">{description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Physical metrics
// ---------------------------------------------------------------------------

function StepMetrics({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const [measurementsOpen, setMeasurementsOpen] = useState(false);

  return (
    <div>
      <SectionTitle title="כמה נתונים פיזיים" subtitle="הנתונים משמשים לחישוב מדויק של הקלוריות והמאקרו שלך" />

      <div className="glass-card flex flex-col gap-6 p-5 sm:p-6">
        {/* Gender toggle */}
        <div>
          <FieldLabel icon={User} text="מין" />
          <div className="grid grid-cols-2 gap-3">
            {(['male', 'female'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setForm((f) => ({ ...f, gender: g }))}
                className={`rounded-xl border px-4 py-2.5 font-semibold transition ${
                  form.gender === g
                    ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                {g === 'male' ? 'זכר' : 'נקבה'}
              </button>
            ))}
          </div>
        </div>

        <NumberField
          icon={Flame}
          label="גיל"
          value={form.age}
          onChange={(v) => setForm((f) => ({ ...f, age: v }))}
          placeholder="למשל 28"
          suffix="שנים"
          min={14}
          max={99}
        />

        <NumberField
          icon={Ruler}
          label="גובה"
          value={form.heightCm}
          onChange={(v) => setForm((f) => ({ ...f, heightCm: v }))}
          placeholder="למשל 178"
          suffix="ס״מ"
          min={120}
          max={230}
        />

        <NumberField
          icon={Weight}
          label="משקל"
          value={form.weightKg}
          onChange={(v) => setForm((f) => ({ ...f, weightKg: v }))}
          placeholder="למשל 75"
          suffix="ק״ג"
          min={35}
          max={250}
        />

        <NumberField
          icon={Footprints}
          label="ממוצע צעדים יומי"
          value={form.averageDailySteps}
          onChange={(v) => setForm((f) => ({ ...f, averageDailySteps: v }))}
          placeholder="למשל 8000"
          suffix="צעדים"
          min={1000}
          max={50000}
        />

        {/* Training days */}
        <div>
          <FieldLabel icon={Dumbbell} text="ימי אימון בשבוע" />
          <div className="grid grid-cols-5 gap-2">
            {TRAINING_DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setForm((f) => ({ ...f, trainingDaysPerWeek: d }))}
                className={`rounded-xl border py-3 text-lg font-bold transition ${
                  form.trainingDaysPerWeek === d
                    ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Optional body measurements accordion */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5">
          <button
            type="button"
            onClick={() => setMeasurementsOpen((o) => !o)}
            className="flex w-full items-center justify-between text-right"
          >
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-lime-700 dark:text-lime-400" />
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">דיוק מתקדם: היקפי גוף (אופציונלי)</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-zinc-600 dark:text-zinc-500 transition-transform ${measurementsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {measurementsOpen && (
            <div className="mt-4 grid grid-cols-1 gap-4 animate-fade-in sm:grid-cols-2">
              <NumberField
                icon={Ruler}
                label="היקף מותן/טבור"
                info={MEASUREMENT_INFO.waistCm}
                value={form.waistCm}
                onChange={(v) => setForm((f) => ({ ...f, waistCm: v }))}
                placeholder="למשל 82"
                suffix="ס״מ"
              />
              <NumberField
                icon={Ruler}
                label="היקף זרוע"
                info={MEASUREMENT_INFO.armCm}
                value={form.armCm}
                onChange={(v) => setForm((f) => ({ ...f, armCm: v }))}
                placeholder="למשל 33"
                suffix="ס״מ"
              />
              <NumberField
                icon={Ruler}
                label="היקף חזה"
                info={MEASUREMENT_INFO.chestCm}
                value={form.chestCm}
                onChange={(v) => setForm((f) => ({ ...f, chestCm: v }))}
                placeholder="למשל 100"
                suffix="ס״מ"
              />
              <NumberField
                icon={Ruler}
                label="היקף ירך"
                info={MEASUREMENT_INFO.hipCm}
                value={form.hipCm}
                onChange={(v) => setForm((f) => ({ ...f, hipCm: v }))}
                placeholder="למשל 95"
                suffix="ס״מ"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldLabel({
  icon: Icon,
  text,
  info,
}: {
  icon: typeof User;
  text: string;
  info?: { title: string; text: string };
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
      <Icon className="h-4 w-4 text-lime-700 dark:text-lime-400" />
      {text}
      {info && <InfoTooltip title={info.title} text={info.text} />}
    </div>
  );
}

function NumberField({
  icon,
  label,
  info,
  value,
  onChange,
  placeholder,
  suffix,
  min,
  max,
}: {
  icon: typeof User;
  label: string;
  info?: { title: string; text: string };
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix: string;
  /** When given, values outside [min, max] show an inline warning - guards the BMR/TDEE formulas from unrealistic input. */
  min?: number;
  max?: number;
}) {
  const numericValue = value.trim() === '' ? null : Number(value);
  const isOutOfRange =
    numericValue !== null &&
    (Number.isNaN(numericValue) || (min !== undefined && numericValue < min) || (max !== undefined && numericValue > max));

  return (
    <div>
      <FieldLabel icon={icon} text={label} info={info} />
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border bg-white dark:bg-zinc-900 px-4 py-3 text-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:ring-2 ${
            isOutOfRange
              ? 'border-orange-400/60 focus:border-orange-400 focus:ring-orange-400/20'
              : 'border-zinc-300 dark:border-zinc-700 focus:border-lime-400 focus:ring-lime-400/20'
          }`}
        />
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-zinc-600 dark:text-zinc-500">
          {suffix}
        </span>
      </div>
      {isOutOfRange && min !== undefined && max !== undefined && (
        <p className="mt-1.5 text-xs text-orange-700 dark:text-orange-400">
          יש להזין ערך בין {min} ל-{max}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Trainee experience questionnaire
// ---------------------------------------------------------------------------

function StepExperience({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  function toggleFocusArea(area: FocusArea) {
    setForm((f) => ({
      ...f,
      focusAreas: f.focusAreas.includes(area)
        ? f.focusAreas.filter((a) => a !== area)
        : [...f.focusAreas, area],
    }));
  }

  function toggleInjury(injury: InjuryArea) {
    setForm((f) => ({
      ...f,
      injuries: f.injuries.includes(injury)
        ? f.injuries.filter((i) => i !== injury)
        : [...f.injuries, injury],
    }));
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="קצת על הניסיון שלך" subtitle="מתאמנים פעילים יקבלו תוכנית מותאמת אישית יותר" />

      <div className="glass-card p-5 sm:p-6">
        <FieldLabel icon={Activity} text="האם אתה מתאמן כרגע באופן פעיל?" />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isCurrentlyTraining: true }))}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              form.isCurrentlyTraining === true
                ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            כן, מתאמן/ת באופן פעיל
          </button>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                isCurrentlyTraining: false,
                experienceYears: null,
                currentSplit: null,
                focusAreas: [],
                hasPlateau: null,
                injuries: [],
                injuryNotes: '',
              }))
            }
            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              form.isCurrentlyTraining === false
                ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            לא, מתחיל/ה מאפס
          </button>
        </div>
      </div>

      {form.isCurrentlyTraining === true && (
        <div className="glass-card flex flex-col gap-6 p-5 sm:p-6 animate-fade-in">
          <div>
            <FieldLabel icon={Dumbbell} text="ותק באימונים" />
            <div className="grid grid-cols-3 gap-2">
              {EXPERIENCE_YEARS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, experienceYears: value }))}
                  className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${
                    form.experienceYears === value
                      ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel icon={Layers} text="חלוקה נוכחית (Split)" />
            <div className="grid grid-cols-2 gap-2">
              {CURRENT_SPLIT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, currentSplit: value }))}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
                    form.currentSplit === value
                      ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel icon={Target} text="נקודות לחיזוק (ניתן לבחור כמה)" />
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREA_OPTIONS.map(({ value, label }) => {
                const selected = form.focusAreas.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleFocusArea(value)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      selected
                        ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                        : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel icon={TrendingDown} text="האם אתה חווה תקיעות (פלאטו) במשקלי עבודה או במשקל גוף?" />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, hasPlateau: true }))}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  form.hasPlateau === true
                    ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                כן
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, hasPlateau: false }))}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  form.hasPlateau === false
                    ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                לא
              </button>
            </div>
          </div>

          <div>
            <FieldLabel icon={AlertTriangle} text="מגבלות / פציעות" />
            <div className="flex flex-wrap gap-2">
              {INJURY_OPTIONS.map(({ value, label }) => {
                const selected = form.injuries.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleInjury(value)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      selected
                        ? 'border-orange-400/50 bg-orange-400/10 text-orange-700 dark:text-orange-400'
                        : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, injuries: [] }))}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  form.injuries.length === 0
                    ? 'border-lime-400/50 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                ללא מגבלות
              </button>
            </div>
            <textarea
              value={form.injuryNotes}
              onChange={(e) => setForm((f) => ({ ...f, injuryNotes: e.target.value }))}
              placeholder="פרטים נוספים על המגבלה (אופציונלי)"
              rows={2}
              className="mt-3 w-full resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Results
// ---------------------------------------------------------------------------

function StepResults({
  name,
  nutritionPlan,
  workoutPlan,
}: {
  name: string;
  nutritionPlan: NutritionPlan;
  workoutPlan: WorkoutPlan;
}) {
  const { targetCalories, macros, tdee } = nutritionPlan;
  const macroKcal = {
    protein: macros.proteinG * 4,
    fat: macros.fatG * 9,
    carbs: macros.carbsG * 4,
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title={`מוכן, ${name || 'אלוף'}! 🎯`} subtitle="הנה תוכנית התזונה והאימונים האישית שלך" />

      <div className="glass-card p-5 sm:p-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-500">יעד קלורי יומי</p>
            <p className="text-4xl font-extrabold text-lime-700 dark:text-lime-400">{targetCalories}</p>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-500">TDEE: {tdee} קק״ל</p>
        </div>

        <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="bg-lime-400" style={{ width: `${(macroKcal.protein / targetCalories) * 100}%` }} />
          <div className="bg-orange-400" style={{ width: `${(macroKcal.fat / targetCalories) * 100}%` }} />
          <div className="bg-zinc-400 dark:bg-zinc-400" style={{ width: `${(macroKcal.carbs / targetCalories) * 100}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <MacroStat color="bg-lime-400" label="חלבון" grams={macros.proteinG} />
          <MacroStat color="bg-orange-400" label="שומן" grams={macros.fatG} />
          <MacroStat color="bg-zinc-400 dark:bg-zinc-400" label="פחמימה" grams={macros.carbsG} />
        </div>
      </div>

      <div className="glass-card p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-lime-700 dark:text-lime-400" />
          <p className="font-bold text-zinc-900 dark:text-zinc-100">{workoutPlan.title}</p>
        </div>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-500">{workoutPlan.description}</p>
        <div className="flex flex-wrap gap-2">
          {workoutPlan.days.map((d) => (
            <span
              key={d.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              {d.dayLabel} &middot; {d.focus}
            </span>
          ))}
        </div>

        {workoutPlan.adaptationNotes && workoutPlan.adaptationNotes.length > 0 && (
          <div className="mt-4 rounded-xl border border-lime-400/20 bg-lime-400/5 p-4">
            <p className="mb-2 text-xs font-bold text-lime-700 dark:text-lime-400">🎯 התאמות אישיות לפי הניסיון שלך</p>
            <ul className="flex flex-col gap-1.5">
              {workoutPlan.adaptationNotes.map((note) => (
                <li key={note} className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MacroStat({ color, label, grams }: { color: string; label: string; grams: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3">
      <div className="mb-1.5 flex items-center justify-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-xs text-zinc-600 dark:text-zinc-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{grams}<span className="mr-1 text-xs font-normal text-zinc-600 dark:text-zinc-500">גר׳</span></p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">{subtitle}</p>
    </div>
  );
}

function Footer({
  step,
  canProceed,
  onBack,
  onNext,
}: {
  step: number;
  canProceed: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {step > 0 && (
        <button type="button" onClick={onBack} className="btn-secondary">
          <ArrowRight className="h-4 w-4" />
          חזרה
        </button>
      )}
      <button type="button" onClick={onNext} disabled={!canProceed} className="btn-primary flex-1">
        {step === TOTAL_STEPS - 1 ? 'כניסה לדשבורד' : 'המשך'}
        <ArrowLeft className="h-4 w-4" />
      </button>
    </div>
  );
}
