import type {
  Gender,
  DayWorkout,
  Exercise,
  ExperienceProfile,
  FocusArea,
  InjuryArea,
  MuscleGroup,
  TargetFocus,
  WorkoutPlan,
} from '../types/fitness';
import { inferBlockOrder, orderExercisesByBlock, type ExerciseBlock } from './exerciseOrdering';
import { findExerciseTemplate, getExerciseAlternatives } from '../data/workoutTemplates';

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

/** The block a focus area leads with (arms stay in their usual place at the end of the session). */
const FOCUS_AREA_BLOCK: Partial<Record<FocusArea, ExerciseBlock>> = {
  upper_chest: 'push',
  back_width: 'pull',
  shoulders: 'push',
  legs_glutes: 'legs',
};

/** The isolation exercise appended to a qualifying day when a focus area is selected. */
const FOCUS_AREA_BOOST_EXERCISE: Record<FocusArea, string> = {
  upper_chest: 'לחיצת חזה בשיפוע עם משקולות',
  back_width: 'פולי עליון לגב רחב',
  shoulders: 'הרחקת כתפיים לצד',
  legs_glutes: 'הרמת אגן (Hip Thrust)',
  arms: 'כפיפת מרפק פטיש',
};

function buildExerciseByName(
  name: string,
  config: { sets: number; repsRange: string; restSeconds: number; notes: string },
): Exercise | null {
  const template = findExerciseTemplate(name);
  if (!template) return null;
  return {
    id: `boost-${name.replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`,
    ...template,
    alternatives: getExerciseAlternatives(name, template.muscleGroup),
    ...config,
  };
}

function buildBoostExercise(name: string): Exercise | null {
  return buildExerciseByName(name, {
    sets: 3,
    repsRange: '12-15',
    restSeconds: 60,
    notes: 'נוסף לפי בחירתך בשאלון ההתאמה כדי להוסיף נפח לקבוצת שריר זו',
  });
}

// ---------------------------------------------------------------------------
// Target muscle emphasis (profile setting "מיקוד והעדפת אימון")
// ---------------------------------------------------------------------------

const LOWER_MUSCLES: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

/** Lower-body focus: glute/leg lifts in this order, placed at the start of every session that trains the legs. */
const LOWER_FOCUS_PRIORITY = [
  'הרמת אגן (Hip Thrust)',
  'סקוואט מוט',
  'דדליפט רומני',
  'מכרעים בולגריים',
  'מכרעים הליכה',
  'לחיצת רגליים במכונה',
];

const OVERHEAD_PRESSES = ['לחיצת כתפיים בעמידה', 'לחיצת כתפיים בשיפוע (מכונה)'];
const LATERAL_RAISE = 'הרחקת כתפיים לצד';

/** Stable reorder: exercises named in `priority` first (in that order), everything else keeps its place. */
function moveToFront(exercises: Exercise[], priority: string[]): Exercise[] {
  const rank = (e: Exercise) => {
    const i = priority.indexOf(e.name);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  return exercises.map((e, index) => ({ e, index })).sort((a, b) => rank(a.e) - rank(b.e) || a.index - b.index).map(({ e }) => e);
}

/** Adds `extra` sets to an exercise unless that would push its muscle past the per-session ceiling. */
function addSetsWithinCap(day: DayWorkout, exerciseId: string, extra: number): DayWorkout {
  const target = day.exercises.find((e) => e.id === exerciseId);
  if (!target || sessionSetsForMuscle(day, target.muscleGroup) + extra > MAX_SETS_PER_MUSCLE_PER_SESSION) return day;
  return { ...day, exercises: day.exercises.map((e) => (e.id === exerciseId ? { ...e, sets: e.sets + extra } : e)) };
}

/**
 * Glutes & legs emphasis: every session that trains the legs gets Hip Thrust (added when missing), the glute/leg lifts move to
 * the front of the workout while the lifter is fresh, and the first two of them get one extra set (within the per-session cap).
 * Upper-only sessions are left alone, so the weekly leg volume rises without touching recovery on other days.
 */
function applyLowerBodyFocus(days: DayWorkout[]): { days: DayWorkout[]; changed: boolean } {
  let changed = false;
  const result = days.map((original) => {
    const lowerCount = original.exercises.filter((e) => LOWER_MUSCLES.includes(e.muscleGroup)).length;
    if (lowerCount === 0) return original;

    let day = original;
    const isDedicatedLegDay = lowerCount >= 3;
    if (!day.exercises.some((e) => e.name === LOWER_FOCUS_PRIORITY[0])) {
      const hipThrust = buildExerciseByName(LOWER_FOCUS_PRIORITY[0], {
        sets: isDedicatedLegDay ? 4 : 3,
        repsRange: '8-12',
        restSeconds: 90,
        notes: 'נוסף בשל הדגש על פלג גוף תחתון וישבן',
      });
      if (hipThrust && sessionSetsForMuscle(day, hipThrust.muscleGroup) + hipThrust.sets <= MAX_SETS_PER_MUSCLE_PER_SESSION) {
        day = { ...day, exercises: [...day.exercises, hipThrust] };
      }
    }

    day = { ...day, exercises: moveToFront(day.exercises, LOWER_FOCUS_PRIORITY) };
    for (const lead of day.exercises.filter((e) => LOWER_FOCUS_PRIORITY.includes(e.name)).slice(0, 2)) {
      day = addSetsWithinCap(day, lead.id, 1);
    }
    changed = true;
    return day;
  });
  return { days: result, changed };
}

/** Adds Hip Thrust (3 sets, within the per-session cap) to every dedicated leg session that lacks it. */
function addGluteWorkToLegDays(days: DayWorkout[]): { days: DayWorkout[]; changed: boolean } {
  let changed = false;
  const result = days.map((day) => {
    const lowerCount = day.exercises.filter((e) => LOWER_MUSCLES.includes(e.muscleGroup)).length;
    if (lowerCount < 3 || day.exercises.some((e) => e.name === LOWER_FOCUS_PRIORITY[0])) return day;
    const hipThrust = buildExerciseByName(LOWER_FOCUS_PRIORITY[0], { sets: 3, repsRange: '8-12', restSeconds: 90, notes: 'ברירת מחדל לנשים - עבודת ישבן' });
    if (!hipThrust || sessionSetsForMuscle(day, hipThrust.muscleGroup) + hipThrust.sets > MAX_SETS_PER_MUSCLE_PER_SESSION) return day;
    changed = true;
    return { ...day, exercises: [...day.exercises, hipThrust] };
  });
  return { days: result, changed };
}

/**
 * Upper body & shoulders emphasis: sessions that train chest or shoulders get an overhead press when they lack one, the shoulder
 * work moves right after the opening lift, and the lateral raise gets an extra set (within the cap). Leg-only and pull-only
 * sessions are left alone.
 */
function applyUpperBodyFocus(days: DayWorkout[]): { days: DayWorkout[]; changed: boolean } {
  let changed = false;
  const result = days.map((original) => {
    const trainsPressMuscles = original.exercises.some((e) => e.muscleGroup === 'chest' || e.muscleGroup === 'shoulders');
    if (!trainsPressMuscles) return original;

    let day = original;
    if (!day.exercises.some((e) => OVERHEAD_PRESSES.includes(e.name))) {
      const press = buildExerciseByName(OVERHEAD_PRESSES[1], {
        sets: 3,
        repsRange: '8-12',
        restSeconds: 90,
        notes: 'נוסף בשל הדגש על פלג גוף עליון וכתפיים',
      });
      if (press && sessionSetsForMuscle(day, 'shoulders') + press.sets <= MAX_SETS_PER_MUSCLE_PER_SESSION) {
        day = { ...day, exercises: [...day.exercises, press] };
      }
    }

    const shoulderWork = moveToFront(
      day.exercises.filter((e) => e.muscleGroup === 'shoulders'),
      [...OVERHEAD_PRESSES, LATERAL_RAISE],
    );
    const [opener, ...others] = day.exercises.filter((e) => e.muscleGroup !== 'shoulders');
    day = { ...day, exercises: opener ? [opener, ...shoulderWork, ...others] : shoulderWork };

    const lateral = day.exercises.find((e) => e.name === LATERAL_RAISE);
    if (lateral) day = addSetsWithinCap(day, lateral.id, 1);
    changed = true;
    return day;
  });
  return { days: result, changed };
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
// Training experience (gym programs)
// ---------------------------------------------------------------------------

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * The level a gym program is shaped for. Someone who is not training now counts as a beginner. A trainee who did not say for how long
 * (and an old profile with no experience data at all) has no level: the base program is left exactly as it is rather than guessed at.
 */
export function getExperienceLevel(experience: ExperienceProfile | undefined): ExperienceLevel | undefined {
  if (!experience) return undefined;
  if (!experience.isCurrentlyTraining) return 'beginner';
  switch (experience.experienceYears) {
    case 'under_1y':
      return 'beginner';
    case '1_3y':
      return 'intermediate';
    case 'over_3y':
      return 'advanced';
    default:
      return undefined;
  }
}

/** One exercise swapped for a variation that suits a level. `to` lists candidates in order of preference (the first not already in the session wins). */
export interface LevelSwap {
  from: string;
  to: string[];
  /** Replaces the rep range when the new exercise needs a different one (a one-sided lift becoming a two-legged one, a heavy range softened for learning). */
  repsRange?: string;
}

/**
 * Beginners: the technically demanding free-barbell lifts and the balance-heavy single-leg and bodyweight pulls give way to stable
 * machine, cable and dumbbell versions of the same movement (same muscle, same sets), which are easier to learn and to load safely.
 * Every target is listed with difficulty "beginner" in the source exercise's swap options (data/workoutTemplates.ts) - a test guards that.
 * Only the exercise changes; sets are untouched, so the weekly volume per muscle is identical to the base program.
 */
export const BEGINNER_SWAPS: LevelSwap[] = [
  { from: 'סקוואט מוט', to: ['לחיצת רגליים במכונה', 'גובלט סקוואט'], repsRange: '8-12' },
  { from: 'דדליפט רומני', to: ['דדליפט רומני עם משקולות'], repsRange: '8-12' },
  { from: 'לחיצת חזה במוט שטוח', to: ['לחיצת חזה במכונה'], repsRange: '8-12' },
  { from: 'חתירת מוט חבוק', to: ['חתירה בכבל ישיבה', 'חתירת דאמבל חד-יד'] },
  { from: 'חתירת T או חתירת מוט', to: ['חתירה בכבל ישיבה', 'חתירת דאמבל חד-יד'] },
  { from: 'לחיצת כתפיים בעמידה', to: ['לחיצת כתפיים בשיפוע (מכונה)'], repsRange: '8-12' },
  { from: 'מתח באחיזה רחבה (או מכונת עזר)', to: ['פולי עליון לגב רחב'] },
  { from: 'מכרעים בולגריים', to: ['גובלט סקוואט'], repsRange: '10-12' },
];

/**
 * Advanced trainees (over 3 years): where the program has a machine press on a variation day, a free-weight press with a longer path
 * replaces it. This is the only slot where the swap data has a more advanced version of the same movement; nothing else about the
 * program changes, because no research ties training age to a different weekly volume.
 */
export const ADVANCED_SWAPS: LevelSwap[] = [{ from: 'לחיצת כתפיים בשיפוע (מכונה)', to: ['לחיצה ארנולד'] }];

const BEGINNER_ACCLIMATION_NOTE =
  'שבועיים ראשונים: 1-2 הסטים הראשונים בתרגיל הראשון הם סטי היכרות בעומס קל, הרחק מכשל (הם נכללים במספר הסטים שבתוכנית).';

/**
 * Applies a level's swaps, keeping each exercise's id, sets and rest. The original is stored in `replacedFrom`, so the existing
 * "back to the original exercise" button restores it. A swap that would put the same exercise in a session twice is skipped.
 */
function applyLevelSwaps(
  days: DayWorkout[],
  swaps: LevelSwap[],
  describe: (from: string) => string,
): { days: DayWorkout[]; swapped: number } {
  let swapped = 0;
  const result = days.map((day) => {
    const names = new Set(day.exercises.map((e) => e.name));
    return {
      ...day,
      exercises: day.exercises.map((exercise) => {
        const swap = swaps.find((s) => s.from === exercise.name);
        if (!swap) return exercise;
        const target = swap.to.find((candidate) => !names.has(candidate) && findExerciseTemplate(candidate));
        const template = target ? findExerciseTemplate(target) : undefined;
        if (!target || !template) return exercise;
        names.delete(exercise.name);
        names.add(target);
        swapped += 1;
        const { replacedFrom: _history, ...original } = exercise;
        return {
          ...exercise,
          ...template,
          repsRange: swap.repsRange ?? exercise.repsRange,
          notes: describe(exercise.name),
          replacedFrom: exercise.replacedFrom ?? original,
        };
      }),
    };
  });
  return { days: result, swapped };
}

/** Each gym split exists for one weekly frequency only (3 full body, 4 upper/lower, 5-6 push/pull/legs), so the chosen days decide the split. */
const SPLIT_LABELS: Record<'fbw' | 'upper_lower' | 'ppl', string> = {
  fbw: 'Full Body',
  upper_lower: 'Upper / Lower',
  ppl: 'Push / Pull / Legs',
};

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
 * declared injuries, and - when a plateau is reported - adds a suggestion about it. The plateau never changes the plan itself: a deload is
 * a one-week choice for when there are real signs of fatigue, and the research on it is thin, so it is offered, not applied.
 */
export function adaptWorkoutPlan(
  basePlan: WorkoutPlan,
  experience: ExperienceProfile | undefined,
  targetFocus: TargetFocus = 'balanced',
  gender?: Gender,
): AdaptedWorkout {
  const trainee = experience?.isCurrentlyTraining ? experience : undefined;
  const level = getExperienceLevel(experience);
  const femaleDefault = gender === 'female' && targetFocus === 'balanced';
  if (!trainee && !level && targetFocus === 'balanced' && !femaleDefault) {
    return { plan: basePlan, notes: [] };
  }

  const notes: string[] = [];
  const injuries = trainee?.injuries ?? [];
  const focusAreas = trainee?.focusAreas ?? [];

  let days: DayWorkout[] = structuredClone(basePlan.days);

  // 0. Target muscle emphasis from the profile ("balanced" keeps the template's even split).
  if (targetFocus === 'lower_body') {
    const focused = applyLowerBodyFocus(days);
    days = focused.days;
    if (focused.changed) notes.push('דגש פלג גוף תחתון וישבן: הרמת אגן, סקוואט, דדליפט רומני ומכרעים מוקדמים בתחילת האימון, עם סט נוסף בתרגילי המפתח.');
  } else if (targetFocus === 'upper_body') {
    const focused = applyUpperBodyFocus(days);
    days = focused.days;
    if (focused.changed) notes.push('דגש פלג גוף עליון וכתפיים: לחיצת כתפיים בכל אימון דחיפה/עליון, עבודת כתפיים מוקדמת וסט נוסף להרחקות לצד.');
  }

  // 0b. Women's default (only when no explicit emphasis was picked). Trained-vs-untrained meta-analyses (Roberts 2020; Refalo 2025)
  // show relative hypertrophy and lower-body strength gains are similar for both sexes, so volume, frequency and rep ranges stay the same.
  // The one default is a glute lift on leg days: a 2023 RCT (Plotkin) found hip thrust grows the glutes about as much as the squat.
  if (femaleDefault) {
    const added = addGluteWorkToLegDays(days);
    days = added.days;
    if (added.changed) {
      notes.push('ברירת מחדל לנשים: נוספה הרמת אגן (Hip Thrust) לימי הרגליים. נפח, תדירות וטווחי חזרות זהים לגברים - מחקרים מראים תגובה יחסית דומה לאימון התנגדות. אפשר לשנות דגש בפרופיל.');
    }
  }

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

  // 1b. Experience: beginners get stable, easy-to-learn versions of the technical lifts; advanced trainees a longer-path press where the data has one.
  // Runs after the injury swaps, so a joint-driven substitution wins over an experience-driven one.
  const levelSuggestions: string[] = [];
  if (level === 'beginner') {
    const swapped = applyLevelSwaps(days, BEGINNER_SWAPS, (from) => `מתחילים: "${from}" הוחלף בגרסה יציבה וקלה יותר ללימוד. כשהטכניקה יציבה אפשר לחזור למקור.`);
    days = swapped.days;
    if (swapped.swapped > 0) {
      notes.push(
        'תוכנית למתחילים: סקוואט, דדליפט רומני, לחיצת חזה, חתירה ולחיצת כתפיים במוט, מתח ומכרעים בולגריים הוחלפו בגרסאות יציבות וקלות ללימוד (מכונות, כבלים ומשקולות) עם טווח חזרות מתון. מספר הסטים השבועי לא השתנה, ואפשר לחזור לכל תרגיל מקורי דרך "חזרה לתרגיל המקורי".',
      );
    }
    notes.push(
      'שבועיים ראשונים: התחל/י את התרגיל הראשון בכל אימון ב-1-2 סטי היכרות בעומס קל, הרחק מכשל, והתמקד/י בטכניקה. הם נכללים בסטים שבתוכנית, ואין כאן סטים נוספים.',
    );
  } else if (level === 'advanced') {
    const swapped = applyLevelSwaps(days, ADVANCED_SWAPS, (from) => `ותק גבוה: "${from}" הוחלף בגרסה מתקדמת יותר. אפשר לחזור למקור.`);
    days = swapped.days;
    if (swapped.swapped > 0) notes.push('ותק של מעל 3 שנים: לחיצת כתפיים במכונה בימי הווריאציה הוחלפה בלחיצה ארנולד עם משקולות. שאר התוכנית ונפח הסטים זהים לכל הרמות.');
    levelSuggestions.push(
      'ותק של מעל 3 שנים: נפח הסטים הנוכחי נשאר בטווח המקובל גם לך - אין מחקר שמצדיק נפח אחר רק לפי ותק. לשינוי אפשר להחליף תרגילים לגרסאות מתקדמות דרך "החלף תרגיל".',
    );
  } else if (level === 'intermediate') {
    levelSuggestions.push(
      'ותק של 1-3 שנים: התוכנית הבסיסית (מוטות חופשיים, מתח ומכונות) מתאימה לרמה שלך כפי שהיא. תעד/י משקלים והעלה/י עומס רק כשמגיעים לקצה טווח החזרות בכל הסטים.',
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

  // 3. Plateau: a suggestion only. The plan is left exactly as it is - an automatic deload would have cut the sets and rep ranges for good, not for a week.
  const suggestions: string[] = [...levelSuggestions];
  if (trainee?.currentSplit && trainee.currentSplit !== 'custom' && trainee.currentSplit !== basePlan.splitType) {
    suggestions.push(
      `ציינת שאתה מתאמן כיום בחלוקה ${SPLIT_LABELS[trainee.currentSplit]}, והתוכנית שלפניך היא ${SPLIT_LABELS[basePlan.splitType]} כי היא זו שמתאימה ל-${basePlan.daysPerWeek} ימי האימון בשבוע שבחרת (לכל חלוקה יש תדירות קבועה). כדי לשמור על החלוקה שלך, שנה/י את מספר ימי האימון או עבור/י לחלוקה אחרת דרך "החלף תוכנית".`,
    );
  }
  if (trainee?.hasPlateau) {
    suggestions.push(
      'דיווחת על תקיעות (פלאטו). לפני שמשנים את התוכנית כדאי לבדוק שלושה דברים: שאתה ישן מספיק, שאתה אוכל מספיק, ושאתה מתעד ומעלה עומס בהדרגה. אם יש גם סימני עייפות אמיתיים (ירידה בביצועים, שינה לא טובה), אפשר לשקול שבוע deload של כ-40% פחות סטים - ראה את המדריך "שבוע Deload". התוכנית לא שונתה אוטומטית.',
    );
  }

  // 4. Re-cluster every session by muscle block: the steps above append or move exercises, which can scatter a muscle.
  const leadFocus = focusAreas[0];
  days = days.map((day) => {
    if (targetFocus === 'lower_body') return { ...day, exercises: orderExercisesByBlock(day.exercises, { blockOrder: ['legs', 'pull', 'push'] }) };
    if (targetFocus === 'upper_body') {
      return { ...day, exercises: orderExercisesByBlock(day.exercises, { blockOrder: ['push', 'pull', 'legs'], shouldersFirst: true }) };
    }
    const leadBlock = leadFocus ? FOCUS_AREA_BLOCK[leadFocus] : undefined;
    const blockOrder = leadBlock ? [leadBlock, ...inferBlockOrder(day).filter((b) => b !== leadBlock)] : inferBlockOrder(day);
    return { ...day, exercises: orderExercisesByBlock(day.exercises, { blockOrder, shouldersFirst: leadFocus === 'shoulders' }) };
  });

  // Beginners: the first lift of each session (after the final ordering) carries the acclimation note.
  if (level === 'beginner') {
    days = days.map((day) => ({
      ...day,
      exercises: day.exercises.map((e, i) => (i === 0 ? { ...e, notes: e.notes ? `${e.notes} ${BEGINNER_ACCLIMATION_NOTE}` : BEGINNER_ACCLIMATION_NOTE } : e)),
    }));
  }

  // Only real changes to the plan make it "personalized"; a suggestion alone does not.
  const wasAdapted = notes.length > 0;
  const allNotes = [...notes, ...suggestions];

  return {
    plan: {
      ...basePlan,
      title: wasAdapted ? `${basePlan.title} (מותאם אישית)` : basePlan.title,
      days,
      adaptationNotes: allNotes.length > 0 ? allNotes : undefined,
    },
    notes: allNotes,
  };
}
