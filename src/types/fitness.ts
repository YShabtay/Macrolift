// ---------------------------------------------------------------------------
// Core enums / unions
// ---------------------------------------------------------------------------

export type Gender = 'male' | 'female';

/** Visual "current state" card the user picks in onboarding. */
export type BodyState = 'lean' | 'athletic' | 'higher_fat';

/** The user's primary goal, drives calorie target math. */
export type Goal = 'lose_weight' | 'maintain' | 'gain_muscle' | 'recomp';

/** Self-reported daily activity outside of training (NEAT proxy via steps). */
export type ActivityLevel =
  | 'sedentary' // under 5,000 steps
  | 'light' // 5,000 - 8,000
  | 'active'; // over 8,000

/**
 * Surplus aggressiveness for the "gain_muscle" (lean bulk) goal.
 * moderate: ~150-200 kcal surplus (clean lean bulk).
 * aggressive: ~300-400 kcal surplus (faster gain, more fat gain risk).
 */
export type GoalIntensity = 'moderate' | 'aggressive';

export type TrainingDaysPerWeek = 2 | 3 | 4 | 5 | 6;

export type WorkoutSplitType = 'fbw' | 'upper_lower' | 'ppl';

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
  | 'kettlebell';

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
  /** Optional advanced-precision circumference measurements. */
  measurements?: BodyMeasurements;
  /** Optional deep-dive questionnaire for experienced trainees. */
  experience?: ExperienceProfile;
}

export interface UserProfile {
  id: string;
  name: string;
  createdAt: string; // ISO date
  metrics: UserMetrics;
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
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  sets: number;
  repsRange: string; // e.g. "8-12"
  restSeconds: number;
  notes?: string;
  /** YouTube video id (the part after v=) for a short technique demo. */
  youtubeId?: string;
  /** 2-3 short, actionable execution cues shown alongside the demo video. */
  cues?: string[];
  /** Physiologically-equivalent exercises the user can swap this one for. */
  alternatives?: ExerciseAlternative[];
  /** Set when the user swapped in a different exercise here; holds the untouched original so it can be restored. */
  replacedFrom?: Omit<Exercise, 'replacedFrom'>;
}

export interface DayWorkout {
  id: string;
  dayLabel: string; // e.g. "יום א׳ - פלג גוף עליון"
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
  /** Human-readable notes on how this plan was personalized (focus areas, deload, injury swaps). */
  adaptationNotes?: string[];
}

// ---------------------------------------------------------------------------
// Progress tracking (dashboard)
// ---------------------------------------------------------------------------

/** Tracks which sets of a given exercise (in a given day, on a given date) are checked off. */
export interface SetProgressEntry {
  exerciseId: string;
  dayId: string;
  date: string; // ISO date, the day the workout was performed
  completedSets: number; // how many sets marked done
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
  /** Local time the entry was logged, "HH:MM" (24h). */
  time?: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** One day's recorded step count. At most one entry per date. */
export interface StepLog {
  date: string; // YYYY-MM-DD
  steps: number;
}

export interface AppState {
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
}
