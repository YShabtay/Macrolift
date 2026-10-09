// ---------------------------------------------------------------------------
// Core enums / unions
// ---------------------------------------------------------------------------

export type Gender = 'male' | 'female';

/** Visual "current state" card the user picks in onboarding. */
export type BodyState = 'lean' | 'athletic' | 'higher_fat';

/** The user's primary goal, drives calorie target math. */
export type Goal = 'lose_weight' | 'maintain' | 'gain_muscle' | 'recomp';

/**
 * Surplus aggressiveness for the "gain_muscle" goal (lean bulk).
 * moderate: ~220 kcal above maintenance (clean lean bulk, ~10% of TDEE).
 * aggressive: ~400 kcal above maintenance (faster gain, more fat gain risk).
 */
export type GoalIntensity = 'moderate' | 'aggressive';

export type TrainingDaysPerWeek = 2 | 3 | 4 | 5 | 6;

export type WorkoutSplitType = 'fbw' | 'upper_lower' | 'ppl';

/** Where the user trains: a gym (full equipment) or at home (bodyweight, or dumbbells and bands). */
export type TrainingLocation = 'gym' | 'home';

/** What a home trainee owns: nothing ('none') or a pair of dumbbells with resistance bands ('dumbbells'). */
export type HomeEquipment = 'none' | 'dumbbells';

/** Which half of the body the generated program gives extra priority and volume to. */
export type TargetFocus = 'balanced' | 'lower_body' | 'upper_body';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'full_body';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band';

// ---------------------------------------------------------------------------
// User input / profile
// ---------------------------------------------------------------------------

/** Optional body-circumference measurements (cm), for more precise tracking over time. */
export interface BodyMeasurements {
  waistCm?: number;
  armCm?: number;
  chestCm?: number;
  hipCm?: number; // displayed as "ירך" (thigh)
}

/** One dated circumference check-in for the ongoing goals/projections tracker (separate from the onboarding snapshot in UserMetrics.measurements). */
export interface CircumferenceEntry extends BodyMeasurements {
  id: string;
  date: string; // YYYY-MM-DD
}

/** User-set circumference goals, per metric, in the same shape as a measurement snapshot. */
export type CircumferenceGoals = BodyMeasurements;

export type TrainingExperience = 'under_1y' | '1_3y' | 'over_3y';

export type CurrentSplit = 'fbw' | 'upper_lower' | 'ppl' | 'custom';

/** Muscle-group emphasis the user wants extra volume on. */
export type FocusArea = 'upper_chest' | 'back_width' | 'shoulders' | 'legs_glutes' | 'arms';

export type InjuryArea = 'shoulder' | 'lower_back' | 'knees';

/** Deep-dive questionnaire for users who are already training, used to adapt the generated plan. */
export interface ExperienceProfile {
  isCurrentlyTraining: boolean;
  experienceYears?: TrainingExperience;
  currentSplit?: CurrentSplit;
  focusAreas?: FocusArea[];
  hasPlateau?: boolean;
  injuries?: InjuryArea[];
  injuryNotes?: string;
}

/** Regions a bulking-period circumference gain target can be set for (thigh is stored under hipCm, matching BodyMeasurements). */
export type BulkingGainRegion = 'armCm' | 'chestCm' | 'hipCm';

/** A planned bulking period: how long it lasts and how many cm of circumference growth the user is aiming for. */
export interface BulkingPlan {
  /** Planned length of the bulk, in months. */
  durationMonths: number;
  /** When the plan was set (YYYY-MM-DD); measured progress and elapsed time are counted from here. */
  startDate: string;
  /** 'overall': one cm target applied to every region. 'per_region': separate target per region. */
  gainMode: 'overall' | 'per_region';
  overallGainCm?: number;
  regionGainCm?: Partial<Record<BulkingGainRegion, number>>;
}

/** Raw physical data collected during onboarding. */
export interface UserMetrics {
  gender: Gender;
  age: number; // years
  heightCm: number;
  weightKg: number;
  averageDailySteps: number;
  trainingDaysPerWeek: TrainingDaysPerWeek;
  bodyState: BodyState;
  goal: Goal;
  /** Only meaningful when goal === 'gain_muscle'; defaults to 'moderate' when omitted. */
  goalIntensity?: GoalIntensity;
  /** Training emphasis for the generated program; 'balanced' (the default) keeps the evidence-based even split. */
  targetFocus?: TargetFocus;
  /** Optional advanced-precision circumference measurements. */
  measurements?: BodyMeasurements;
  /** Optional deep-dive questionnaire for experienced trainees. */
  experience?: ExperienceProfile;
  /** Optional planned bulking period (duration + circumference gain targets); only meaningful when goal === 'gain_muscle'. */
  bulkingPlan?: BulkingPlan;
  /** Personal correction (kcal per day, positive or negative) added to the formula's TDEE after calibrating against the user's weight trend; omitted means none. */
  tdeeAdjustmentKcal?: number;
  /**
   * A correction (kcal per day, positive or negative) the user accepted after the weight trend showed the target was off, or set by hand to try a
   * different amount: it moves the whole calorie range and the target. Omitted means none. Set together with targetAdjustmentDate, the day it was accepted, from which the next check starts.
   */
  targetAdjustmentKcal?: number;
  targetAdjustmentDate?: string;
  /**
   * Optional target body weight (kg), judged on weekly averages. targetWeightStartKg is the weight when it was set, the starting point for the progress bar.
   * Both are omitted when no target is set.
   */
  targetWeightKg?: number;
  targetWeightStartKg?: number;
  /** Where the user trains; omitted (older profiles) means the gym. */
  trainingLocation?: TrainingLocation;
  /** Home trainees only: the equipment they have; defaults to none. */
  homeEquipment?: HomeEquipment;
  /** Home trainees only: their level, which sets how hard the exercise variations are; defaults to beginner. */
  homeLevel?: ExerciseDifficulty;
}

export interface UserProfile {
  id: string;
  name: string;
  createdAt: string; // ISO date
  metrics: UserMetrics;
  /** True for the on-device guest profile created by "continue as guest". */
  isGuest?: boolean;
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export interface MacroGrams {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface NutritionPlan {
  bmr: number; // Basal Metabolic Rate (Mifflin-St Jeor)
  tdee: number; // Total Daily Energy Expenditure
  targetCalories: number; // Adjusted for goal
  macros: MacroGrams;
  calorieDeficitOrSurplus: number; // Negative = deficit, positive = surplus
  /**
   * The calories to eat: a range, not one number, because TDEE is an estimate. Plans stored before the range existed lack these.
   * For a surplus goal the target starts at the bottom of the range, for a deficit goal at the top (the safe end either way).
   */
  targetMin?: number;
  targetMax?: number;
  /** What the goal asks for relative to maintenance (+220 lean bulk, -400 cut, ...), before the range shifts the starting point. */
  intendedOffsetKcal?: number;
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** A physiologically-equivalent swap-in candidate for an exercise (same movement pattern / target muscle). */
export interface ExerciseAlternative {
  id: string;
  name: string;
  nameEn: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  difficulty: ExerciseDifficulty;
  /** Short value proposition, e.g. "מוריד עומס מהגב התחתון". */
  reason: string;
  /** Overrides the original exercise's rep range when the swap calls for a different one; otherwise it's kept. */
  repsRange?: string;
}

export interface Exercise {
  id: string;
  name: string;
  /** English name, used for the YouTube search fallback (e.g. "Dumbbell Bench Press"). */
  nameEn?: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  sets: number;
  repsRange: string; // e.g. "8-12"
  restSeconds: number;
  notes?: string;
  /** YouTube video id (the part after v=) for a short technique demo. */
  youtubeId?: string;
  /** Optional short looping demo (GIF, WebM or MP4) shown above the video; WebM/MP4 play muted so they never interrupt background music. */
  demoUrl?: string;
  /** 2-3 short, actionable execution cues shown alongside the demo video. */
  cues?: string[];
  /** Physiologically-equivalent exercises the user can swap this one for. */
  alternatives?: ExerciseAlternative[];
  /** Set when the user swapped in a different exercise here; holds the untouched original so it can be restored. */
  replacedFrom?: Omit<Exercise, 'replacedFrom'>;
}

export interface DayWorkout {
  id: string;
  dayLabel: string; // flexible session name, e.g. "אימון A (פלג גוף עליון)" - not tied to a weekday
  focus: string; // e.g. "Upper Body Push"
  exercises: Exercise[];
}

export interface WorkoutPlan {
  id: string;
  splitType: WorkoutSplitType;
  daysPerWeek: TrainingDaysPerWeek;
  title: string;
  description: string;
  days: DayWorkout[];
  /** Set on programs built for training at home; omitted for the gym programs. */
  location?: TrainingLocation;
  /** True for a plan the user built or edited by hand; automatic program changes then leave it alone. */
  isCustom?: boolean;
  /** Human-readable notes on how this plan was personalized (focus areas, deload, injury swaps). */
  adaptationNotes?: string[];
}

// ---------------------------------------------------------------------------
// Progress tracking (dashboard)
// ---------------------------------------------------------------------------

/** Tracks which sets of a given exercise (in a given day, on a given date) are checked off. */
/** What was actually lifted in one completed set. Either value may be missing (a set can be ticked without writing numbers down). */
export interface SetLog {
  weightKg?: number;
  reps?: number;
}

export interface SetProgressEntry {
  exerciseId: string;
  dayId: string;
  date: string; // ISO date, the day the workout was performed
  completedSets: number; // how many sets marked done
  /** The exercise's name when logged - history and personal records follow the exercise across plan changes (ids don't survive those). */
  exerciseName?: string;
  /** Weight and reps per completed set, in set order (index 0 = set 1). */
  sets?: SetLog[];
}

/** A single daily body-weight entry. At most one per calendar date. */
export interface WeightLog {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  notes?: string;
}

/** A dated progress photo, stored locally as a data URL. */
export interface ProgressPhoto {
  id: string;
  date: string; // YYYY-MM-DD
  photoUrl: string; // base64 data URL
  weightKg?: number;
  notes?: string;
}

/**
 * What's planned for a given calendar date: a real DayWorkout.id from the plan,
 * or the sentinel values 'rest' or 'custom'. At most one entry per date.
 */
export interface WorkoutScheduleEntry {
  date: string; // YYYY-MM-DD
  dayId: string;
  /** Only used when dayId === 'custom'. */
  customLabel?: string;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

/** One logged food item, on one date, under one meal. */
export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  meal: Meal;
  name: string;
  quantity: string; // free-text descriptive quantity, e.g. "100 גרם" or "1 יחידה"
  /** Numeric portion weight in grams, when known - powers weight-ratio recalculation when editing. */
  weightGrams?: number;
  /** The amount as the user said it in natural units, e.g. "3 ביצים" - shown as the entry title when set. */
  unitLabel?: string;
  /** Local time the entry was logged, "HH:MM" (24h). */
  time?: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** A food as it was logged, without the day / meal it was logged on - the reusable part of an entry. */
export type FoodTemplate = Omit<FoodEntry, 'id' | 'date' | 'meal' | 'time'>;

/** A food the user starred, to add again in one tap. */
export type FavoriteFood = FoodTemplate & { id: string };

/** A named set of foods ("ארוחת בוקר רגילה") that is added to a meal in one tap. */
export interface SavedMeal {
  id: string;
  name: string;
  items: FoodTemplate[];
}

/** One day's recorded step count. At most one entry per date. */
export interface StepLog {
  date: string; // YYYY-MM-DD
  steps: number;
}

/** A natural way to count a food (one date, one slice, a tablespoon) and what it weighs, so users can log units instead of grams. */
export interface ServingUnit {
  name: string; // e.g. "יחידה", "פרוסה", "כף", "כוס"
  grams: number; // weight of one such unit
}

/** A food's nutrition values normalized per 100 grams - the unit every search result is stored and scaled in. */
export interface FoodPer100g {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingUnit: 'גרם';
  /** Optional counting units with their typical weight, e.g. an egg = 55 g. */
  servingUnits?: ServingUnit[];
  /** Extra search terms (e.g. the original query an AI-looked-up food was found with). */
  aliases?: string[];
  /** True for foods looked up through Gemini and cached locally. */
  fromAI?: boolean;
}

export interface AppState {
  /** Which TDEE model calculated nutritionPlan; a plan from an older model is recalculated when the app loads. */
  nutritionFormulaVersion?: number;
  profile: UserProfile;
  nutritionPlan: NutritionPlan;
  workoutPlan: WorkoutPlan;
  progress: SetProgressEntry[];
  weightLogs: WeightLog[];
  progressPhotos: ProgressPhoto[];
  schedule: WorkoutScheduleEntry[];
  foodLog: FoodEntry[];
  stepLogs: StepLog[];
  circumferenceLogs: CircumferenceEntry[];
  circumferenceGoals: CircumferenceGoals;
  /** Daily step target set from the steps card; the app falls back to 10,000 when unset. */
  stepGoal?: number;
  /** Foods the user starred for one-tap logging. */
  favoriteFoods?: FavoriteFood[];
  /** Meals the user saved to log again as a whole. */
  savedMeals?: SavedMeal[];
  /** 'weekly' (default): stepGoal is a per-day AVERAGE for the week and surplus/shortfall carries across days; 'daily': a fixed goal for every day. */
  stepGoalMode?: 'weekly' | 'daily';
  /**
   * What walking above the goal does. 'balance_steps' (default): the steps already walked lower what the remaining days of the week need, and the
   * calorie budget is untouched. 'add_calories': the goal for the coming days stays as it is, and the steps above the goal on each day are added to
   * that same day's calorie budget. One or the other, never both, so the same steps are never counted twice.
   */
  stepMode?: 'balance_steps' | 'add_calories';
  /**
   * Dates the user marked a workout as done (quick-complete from the home screen). Kept in addition to the per-set `progress`
   * so a completed day still counts after the program is switched (the old plan's exercises no longer exist).
   */
  completedWorkoutDates?: string[];
  /** Temporary adjustments from the weekly calorie rebalance; each applies only within its own week and lapses on its own. */
  weeklyBalance?: WeeklyBalanceAdjustment;
}

/** What the user chose after a calorie overshoot (see utils/weeklyBalance.ts). Stale once `weekStart` is no longer the current week. */
export interface WeeklyBalanceAdjustment {
  /** Sunday of the week this applies to. */
  weekStart: string;
  /**
   * Calories from the week's extra steps that the user chose to eat on specific days (date -> kcal added to that day's target). The extra steps already
   * burned that energy, so this moves it into the day's target instead of leaving it as a loose credit; the days before today keep their entry so the
   * past is never rewritten.
   */
  stepAllowance?: Record<string, number>;
  /** Daily calorie target reduction for the rest of the week, starting at `fromDate`. */
  calorie?: { reductionKcal: number; fromDate: string };
  /** Extra daily steps on top of the step goal for the rest of the week, starting at `fromDate`. */
  steps?: {
    /**
     * GROSS extra steps per day the rebalance asks for, before crediting steps already walked. The goal actually shown subtracts the
     * bonus steps from earlier days (read live from the step history), so correcting an earlier day changes it immediately.
     */
    boost: number;
    /** How many days the boost is spread over (1 for a one-day catch-up); the credit is shared between them. Derived from the dates when omitted. */
    days?: number;
    fromDate: string;
    /** Last day the boost covers; omitted = through the end of the week. */
    toDate?: string;
  };
}
