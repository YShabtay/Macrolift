import type {
  DayWorkout,
  Exercise,
  ExperienceProfile,
  FocusArea,
  InjuryArea,
  MuscleGroup,
  WorkoutPlan,
} from '../types/fitness';
import { findExerciseTemplate } from '../data/workoutTemplates';

/**
 * Practical per-session ceiling for one muscle (see the research notes in data/workoutTemplates.ts): beyond roughly
 * 6-8 hard sets in a single workout the extra sets add fatigue more than growth ("junk volume"), so personalization
 * never stacks a muscle past this - extra weekly volume has to come from another session instead.
 */
const MAX_SETS_PER_MUSCLE_PER_SESSION = 8;

function sessionSetsForMuscle(day: DayWorkout, muscle: MuscleGroup): number {
  return day.exercises.filter((e) => e.muscleGroup === muscle).reduce((sum, e) => sum + e.sets, 0);
}

// ---------------------------------------------------------------------------
// Focus-area volume boost
// ---------------------------------------------------------------------------

const FOCUS_AREA_LABELS: Record<FocusArea, string> = {
  upper_chest: 'חזה עליון',
  back_width: 'גב ורוחב',
  shoulders: 'כתפיים',
  legs_glutes: 'רגליים/ישבן',
  arms: 'זרועות',
};

/** Which muscle groups a focus area targets, used to decide which days qualify for the boost. */
const FOCUS_AREA_MUSCLES: Record<FocusArea, MuscleGroup[]> = {
  upper_chest: ['chest'],
  back_width: ['back'],
  shoulders: ['shoulders'],
  legs_glutes: ['quads', 'hamstrings', 'glutes'],
  arms: ['biceps', 'triceps'],
};

/** The isolation exercise appended to a qualifying day when a focus area is selected. */
const FOCUS_AREA_BOOST_EXERCISE: Record<FocusArea, string> = {
  upper_chest: 'לחיצת חזה בשיפוע עם משקולות',
  back_width: 'פולי עליון לגב רחב',
  shoulders: 'הרחקת כתפיים לצד',
  legs_glutes: 'הרמת אגן (Hip Thrust)',
  arms: 'כפיפת מרפק פטיש',
};

function buildBoostExercise(name: string): Exercise | null {
  const template = findExerciseTemplate(name);
  if (!template) return null;
  return {
    id: `boost-${name.replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`,
    ...template,
    sets: 3,
    repsRange: '12-15',
    restSeconds: 60,
    notes: 'נוסף לפי בחירתך בשאלון ההתאמה כדי להוסיף נפח לקבוצת שריר זו',
  };
}

// ---------------------------------------------------------------------------
// Injury-safe substitutions
// ---------------------------------------------------------------------------

const INJURY_LABELS: Record<InjuryArea, string> = {
  shoulder: 'כתף',
  lower_back: 'גב תחתון',
  knees: 'ברכיים',
};

const INJURY_SUBSTITUTIONS: Record<InjuryArea, Record<string, string>> = {
  shoulder: {
    'לחיצת חזה במוט שטוח': 'לחיצת חזה בשיפוע עם משקולות',
    'לחיצת כתפיים בעמידה': 'לחיצת כתפיים בשיפוע (מכונה)',
    'מתח באחיזה רחבה (או מכונת עזר)': 'מתח באחיזה צרה',
  },
  lower_back: {
    'סקוואט מוט': 'לחיצת רגליים במכונה',
    'דדליפט רומני': 'כפיפת ברך שכיבה',
    'חתירת מוט חבוק': 'חתירה בכבל ישיבה',
  },
  knees: {
    'סקוואט מוט': 'לחיצת רגליים במכונה',
    'מכרעים בולגריים': 'לחיצת רגליים במכונה',
    'מכרעים הליכה': 'לחיצת רגליים במכונה',
  },
};

function substituteExercise(exercise: Exercise, injuries: InjuryArea[], dayExerciseNames: Set<string>): Exercise {
  for (const injury of injuries) {
    const replacementName = INJURY_SUBSTITUTIONS[injury][exercise.name];
    // Skip a swap that would put the same exercise in the session twice.
    if (!replacementName || dayExerciseNames.has(replacementName)) continue;
    const template = findExerciseTemplate(replacementName);
    if (!template) continue;
    return {
      ...exercise,
      ...template,
      notes: `הוחלף מ"${exercise.name}" בשל רגישות ב${INJURY_LABELS[injury]}`,
    };
  }
  return exercise;
}

// ---------------------------------------------------------------------------
// Plateau / deload adjustment
// ---------------------------------------------------------------------------

/** Main compound lifts whose rep range shifts heavier (6-8) during a deload week. */
const DELOAD_HEAVY_LIFTS = new Set([
  'סקוואט מוט',
  'דדליפט רומני',
  'לחיצת חזה במוט שטוח',
  'חתירת מוט חבוק',
  'לחיצת כתפיים בעמידה',
  'מתח באחיזה רחבה (או מכונת עזר)',
]);

function applyDeload(exercise: Exercise): Exercise {
  const reducedSets = Math.max(exercise.sets - 1, 2);
  const isHeavyLift = DELOAD_HEAVY_LIFTS.has(exercise.name);
  return {
    ...exercise,
    sets: reducedSets,
    repsRange: isHeavyLift ? '6-8' : exercise.repsRange,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface AdaptedWorkout {
  plan: WorkoutPlan;
  notes: string[];
}

/**
 * Personalizes a base workout template using the experienced-trainee questionnaire:
 * adds volume for chosen focus areas, swaps in joint-friendly substitutes for
 * declared injuries, and applies a lighter deload week when a plateau is reported.
 */
export function adaptWorkoutPlan(basePlan: WorkoutPlan, experience: ExperienceProfile | undefined): AdaptedWorkout {
  if (!experience || !experience.isCurrentlyTraining) {
    return { plan: basePlan, notes: [] };
  }

  const notes: string[] = [];
  const injuries = experience.injuries ?? [];
  const focusAreas = experience.focusAreas ?? [];

  let days: DayWorkout[] = structuredClone(basePlan.days);

  // 1. Injury-safe substitutions.
  if (injuries.length > 0) {
    days = days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => substituteExercise(ex, injuries, new Set(day.exercises.map((e) => e.name)))),
    }));
    notes.push(
      `התאמנו תרגילים מסוימים לחלופות בטוחות יותר בשל: ${injuries.map((i) => INJURY_LABELS[i]).join(', ')}.`,
    );
  }

  // 2. Focus-area volume boost - append the boost exercise once per qualifying day.
  for (const focusArea of focusAreas) {
    const boostName = FOCUS_AREA_BOOST_EXERCISE[focusArea];
    const targetMuscles = FOCUS_AREA_MUSCLES[focusArea];
    let added = false;
    let cappedByVolume = false;

    days = days.map((day) => {
      const alreadyHasBoost = day.exercises.some((ex) => ex.name === boostName);
      const dayTargetsMuscle = day.exercises.some((ex) => targetMuscles.includes(ex.muscleGroup));
      if (alreadyHasBoost || !dayTargetsMuscle) return day;

      const boostExercise = buildBoostExercise(boostName);
      if (!boostExercise) return day;

      // Don't turn a well-built session into junk volume for that muscle.
      if (sessionSetsForMuscle(day, boostExercise.muscleGroup) + boostExercise.sets > MAX_SETS_PER_MUSCLE_PER_SESSION) {
        cappedByVolume = true;
        return day;
      }

      added = true;
      return { ...day, exercises: [...day.exercises, boostExercise] };
    });

    if (added) {
      notes.push(`הוספנו נפח נוסף ל${FOCUS_AREA_LABELS[focusArea]} לפי הדגשים שבחרת.`);
    } else if (cappedByVolume) {
      notes.push(
        `לא הוספנו נפח ל${FOCUS_AREA_LABELS[focusArea]}: הנפח באימונים כבר בטווח האפקטיבי (עד 6-8 סטים לשריר באימון), ותוספת הייתה רק מעייפת בלי להוסיף צמיחה.`,
      );
    }
  }

  // 3. Plateau -> deload week (reduced volume, heavier/lower reps on main lifts).
  if (experience.hasPlateau) {
    days = days.map((day) => ({ ...day, exercises: day.exercises.map(applyDeload) }));
    notes.push(
      'זיהינו תקיעות (פלאטו) שדיווחת עליה - התוכנית הותאמה לשבוע דילואד: נפח מופחת וטווח חזרות כבד יותר (6-8) בתרגילי הליבה, כדי לאפשר התאוששות למערכת העצבים לפני שממשיכים להעלות.',
    );
  }

  const wasAdapted = notes.length > 0;

  return {
    plan: {
      ...basePlan,
      title: wasAdapted ? `${basePlan.title} (מותאם אישית)` : basePlan.title,
      days,
      adaptationNotes: wasAdapted ? notes : undefined,
    },
    notes,
  };
}
