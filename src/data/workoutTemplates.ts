/**
 * Workout templates (FBW, Upper/Lower, PPL). Evidence they lean on (checked against the published abstracts):
 *
 * - Weekly volume - Schoenfeld, Ogborn & Krieger (2017, J Sports Sci; 15 studies): hypertrophy rises with weekly sets, with
 *   10+ sets per muscle clearly ahead of fewer. Baz-Valle, Fontes-Villalba & Santos-Concejero (2022, J Hum Kinet; 7 RCTs):
 *   12-20 weekly sets per muscle suggested - but only in trained young MEN (18-35), and 12-20 vs >20 showed no difference for
 *   quads and biceps (triceps favored more). These templates target 12-16 direct sets/week for the big four (chest, back, quads,
 *   hamstrings) in every program - verified by counting the sets per muscle in each template; for women and other groups that
 *   range is an extrapolation, not a tested prescription.
 * - Frequency - Schoenfeld, Ogborn & Krieger (2016, Sports Med) found higher frequency better, but it was confounded with volume.
 *   The volume-equated update (Schoenfeld, Grgic & Krieger 2019, J Sports Sci; 25 studies) found NO meaningful difference. So
 *   splitting a muscle across two sessions is a convenience that keeps per-session volume manageable, not a hypertrophy rule.
 * - Per-session cap - a practical guideline, NOT a meta-analytic cut-off: about 6-8 hard sets per muscle per session
 *   (diminishing returns). Plan adaptation (utils/workoutAdaptation.ts) enforces the same cap.
 * - Exercise variation - Fonseca et al. (2014, J Strength Cond Res; 49 active adults, 12 weeks): varying exercises improved
 *   STRENGTH more, while hypertrophy was similar. Variant "a"/"b" days rotate exercises for that reason; it is not a hypertrophy claim.
 * - Shoulders - EMG work and a 2025 trial (Frontiers in Physiology) support lateral raises for the lateral deltoid, so every
 *   shoulder session includes them; overhead pressing is not required for deltoid growth.
 * - Glutes - Plotkin et al. (2023, Frontiers in Physiology; untrained college-aged adults): hip thrust and squat gave similar
 *   glute growth; squat gave more thigh growth. Hence both appear in leg work.
 * - Men vs women - Roberts, Nuckols & Krieger (2020, J Strength Cond Res; 10 hypertrophy studies): no significant sex difference
 *   in hypertrophy or lower-body strength gains; relative upper-body strength gains favored women. Refalo et al. (2025, PeerJ;
 *   29 studies): relative muscle growth similar, absolute upper-body growth favored men. Conclusion: the same core programming
 *   fits both; the only sex default is the glute emphasis added in utils/workoutAdaptation.ts, a preference-based choice.
 *
 * Rep ranges: heavy compounds 6-10 (rest 90-120 s), complementary lifts 8-12, isolation 10-15 (rest 60-90 s) - conventional
 * practice, not a single study's result.
 */
import type {
  DayWorkout,
  Equipment,
  Exercise,
  ExerciseAlternative,
  ExerciseDifficulty,
  MuscleGroup,
  TrainingDaysPerWeek,
  WorkoutPlan,
  WorkoutSplitType,
} from '../types/fitness';
import { orderExercisesByBlock, type ExerciseBlock } from '../utils/exerciseOrdering';
import { findHomeExercise, getHomeExerciseLibrary } from './homeWorkoutTemplates';

// ---------------------------------------------------------------------------
// Exercise technique demos (YouTube short-form tutorials + execution cues)
// ---------------------------------------------------------------------------

/** Keyed by exact exercise name. Every exercise used below has an entry here (cues always; youtubeId when a verified video exists). */
const EXERCISE_MEDIA: Record<string, { youtubeId?: string; cues: string[] }> = {
  // Exercises below without a youtubeId intentionally omit it rather than guess a video: the player falls back to a YouTube search.
  'פרפר בכבלים': {
    cues: ['מרפקים כפופים מעט וקבועים, התנועה מגיעה מהכתף והחזה', 'עצירה קצרה בכיווץ מלא מול החזה, חזרה איטית עד מתיחה נוחה'],
  },
  'פרפר במכונה (פק דק)': {
    cues: ['שכמות צמודות למשענת, חזה מורם', 'סגירה מבוקרת עד כיווץ החזה וחזרה איטית לטווח מתיחה מלא'],
  },
  'סקוואט מוט': {
    youtubeId: 'rrJIyZGlK8c',
    cues: ['שמירה על גב ישר וחזה מורם לאורך כל התנועה', 'ברכיים בקו עם קצות הבהונות, לא קורסות פנימה'],
  },
  'דדליפט רומני': {
    youtubeId: '5rIqP63yWFg',
    cues: ['המוט נשאר צמוד לרגליים לאורך כל הטווח', 'תחושת מתיחה בהמסטרינג, ברך כמעט נעולה אך לא נעולה'],
  },
  'לחיצת חזה במוט שטוח': {
    youtubeId: 'hWbUlkb5Ms4',
    cues: ['שכמות מקורבות ותחת המושכות למטה לכל אורך התנועה', 'המוט יורד לגובה החזה התחתון, מרפקים בזווית של כ-45°'],
  },
  'לחיצת חזה בשיפוע עם משקולות': {
    youtubeId: '8fXfwG4ftaQ',
    cues: ['שיפוע ספסל של 30-45 מעלות בלבד', 'המשקולות יורדות עד לקו החזה העליון, ללא נעילת מרפק מלאה'],
  },
  'לחיצת כתפיים בעמידה': {
    youtubeId: 'zoN5EH50Dro',
    cues: ['ליבה מהודקת, ללא קשת יתר בגב התחתון', 'המוט עולה בקו ישר מעל הכתפיים'],
  },
  'לחיצת כתפיים בשיפוע (מכונה)': {
    youtubeId: '6v4nrRVySj0',
    cues: ['גב צמוד למשענת לאורך כל התנועה', 'תנועה מבוקרת, ללא נעילת מרפקים בקצה העליון'],
  },
  'לחיצת רגליים במכונה': {
    youtubeId: 'nDh_BlnLCGc',
    cues: ['תחתית הגב נשארת צמודה למושב', 'ברכיים לא נסגרות מעבר לקו האצבעות'],
  },
  'חתירה בכבל ישיבה': {
    youtubeId: 'qD1WZ5pSuvk',
    cues: ['משיכה מובלת מהמרפקים לאחור, לא מהידיים בלבד', 'גב זקוף, ללא נדנוד גוף מוגזם'],
  },
  'חתירת T או חתירת מוט': {
    youtubeId: '8pR3JoZ0iBU',
    cues: ['גו נייח בזווית קבועה, ליבה מהודקת למניעת עומס על הגב', 'משיכה לכיוון הבטן התחתונה תוך סחיטת השכמות'],
  },
  'חתירת מוט חבוק': {
    youtubeId: 'Nqh7q3zDCoQ',
    cues: ['גב ישר בזווית של כ-45 מעלות לאורך כל הסט', 'המוט נמשך לכיוון הבטן, מרפקים קרובים לגוף'],
  },
  'מתח באחיזה רחבה (או מכונת עזר)': {
    youtubeId: '9rckBLbVe8c',
    cues: ['התחלה מתלייה מלאה, סיום עם סנטר מעל המוט', 'המשיכה מובלת מהגב ולא מהזרועות בלבד'],
  },
  'מתח באחיזה צרה': {
    youtubeId: '906kGe7_Kec',
    cues: ['אחיזה בגובה הכתפיים, כפות הידיים פונות פנימה', 'עלייה מבוקרת וירידה איטית לשליטה מלאה'],
  },
  'פולי עליון לגב רחב': {
    youtubeId: 'bNmvKpJSWKM',
    cues: ['נטייה קלה לאחור בלבד, ללא נדנוד גוף', 'המוט יורד לגובה החזה העליון תוך סחיטת השכמות'],
  },
  'כפיפת מרפק במוט': {
    youtubeId: '54x2WF1_Suc',
    cues: ['מרפקים צמודים לגוף לאורך כל התנועה', 'ללא נדנוד גוף - התנועה מגיעה מהביצפס בלבד'],
  },
  'כפיפת מרפק בפולי': {
    youtubeId: 'CrbTqNOlFgE',
    cues: ['מתח קבוע על השריר לכל אורך הטווח', 'מרפקים יציבים, לא נעים קדימה או אחורה'],
  },
  'כפיפת מרפק פטיש': {
    youtubeId: 'lmIo_gVE8T4',
    cues: ['אחיזה נייטרלית (כפות ידיים פונות זו לזו) לכל אורך התנועה', 'מרפקים צמודים לגוף, ללא נפנוף המשקולת'],
  },
  'פשיטת מרפק בפולי': {
    youtubeId: '1FjkhpZsaxc',
    cues: ['מרפקים צמודים לגוף ונייחים לאורך כל התנועה', 'פשיטה מלאה למטה תוך כיווץ הטריצפס'],
  },
  'פשיטת מרפק מעל הראש': {
    youtubeId: 'b5le--KkyH0',
    cues: ['מרפקים קרובים לראש ולא נפתחים לצדדים', 'ירידה מבוקרת עד תחושת מתיחה מלאה בטריצפס'],
  },
  'הרחקת כתפיים לצד': {
    youtubeId: 'Kl3LEzQ5Zqs',
    cues: ['הרמה עד גובה הכתפיים בלבד, ללא שימוש בתנופה', 'מרפקים מעט כפופים - המרפק מוביל את התנועה ולא כף היד'],
  },
  'כפיפת ברך שכיבה': {
    youtubeId: '_lgE0gPvbik',
    cues: ['האגן צמוד לספסל לאורך כל התנועה', 'כיווץ מלא בחלק העליון, ירידה מבוקרת'],
  },
  'פשיטת ברך במכונה': {
    youtubeId: 'uM86QE59Tgc',
    cues: ['גב צמוד למשענת, ללא הרמת האגן', 'עצירה קלה בקצה העליון עם כיווץ הריבועי'],
  },
  'הרמת אגן (Hip Thrust)': {
    youtubeId: 'W86oVlnLqY4',
    cues: ['סנטר צמוד לחזה, מבט קדימה ולא כלפי מעלה', 'כיווץ מלא של הישבן בחלק העליון של התנועה'],
  },
  'מכרעים בולגריים': {
    youtubeId: 'uBSoEWZu07k',
    cues: ['רוב משקל הגוף על הרגל הקדמית', 'הברך הקדמית לא חורגת משמעותית מקצות הבהונות'],
  },
  'מכרעים הליכה': {
    youtubeId: 'Pbmj6xPo-Hw',
    cues: ['צעד ארוך מספיק ליצירת זווית 90° בברך הקדמית', 'פלג גוף עליון זקוף, ללא נטייה קדימה'],
  },
  'הרמת שוקיים בעמידה': {
    youtubeId: '_OewEscCsbo',
    cues: ['עלייה מלאה על קצות הבהונות עם עצירה קלה למעלה', 'ירידה איטית מתחת לקו המדרגה למתיחה מקסימלית'],
  },
  'הרמת שוקיים בישיבה': {
    youtubeId: '60XGTGOjdXA',
    cues: ['תנועה מלאה מטווח מתיחה ועד כיווץ מקסימלי', 'עצירה של שנייה בחלק העליון לפני הירידה'],
  },
  פלאנק: {
    youtubeId: 'xe2MXatLTUw',
    cues: ['קו ישר מהראש ועד העקבים, האגן לא שוקע', 'ליבה מהודקת ונשימה סדירה לאורך כל הזמן'],
  },
  'פלאנק צידי': {
    youtubeId: 'BFOyHDlY2UE',
    cues: ['המרפק בדיוק מתחת לכתף, הגוף בקו ישר אחד', 'האגן מורם ומיוצב, ללא סיבוב לפנים או לאחור'],
  },
  'כפיפות בטן עם משקל': {
    youtubeId: 'kZvSaq192cg',
    cues: ['תנועה מבוקרת ללא תנופה מהצוואר', 'המשקל צמוד לחזה, נשיפה בעלייה'],
  },
  'הרמת ברכיים תלויה': {
    youtubeId: '2n4UqRIJyk4',
    cues: ['תלייה יציבה, ליבה מהודקת למניעת נדנוד', 'הרמת הברכיים באמצעות הבטן התחתונה, לא בתנופת הרגליים'],
  },
};

// ---------------------------------------------------------------------------
// Exercise substitution ("swap exercise") alternatives
// ---------------------------------------------------------------------------

/**
 * Keyed by exact exercise name. Lists physiologically-equivalent swap-in candidates
 * (same movement pattern / target muscle) for the app's main compound lifts.
 * Alternatives that reuse an existing template exercise's name automatically pick up
 * its real YouTube demo via `findExerciseTemplate` at swap time (see `utils/exerciseSwap.ts`) -
 * brand-new exercises below intentionally omit youtubeId/cues rather than guess a video id.
 */
const BASE_ALTERNATIVES: Record<string, ExerciseAlternative[]> = {
  'פרפר בכבלים': [
    {
      id: 'alt-pec-deck',
      name: 'פרפר במכונה (פק דק)',
      nameEn: 'Pec Deck Fly',
      muscleGroup: 'chest',
      equipment: 'machine',
      difficulty: 'beginner',
      reason: 'מסלול קבוע ויציב, אידיאלי להתמקדות בכיווץ החזה',
    },
    {
      id: 'alt-dumbbell-fly',
      name: 'פרפר עם משקולות',
      nameEn: 'Dumbbell Fly',
      muscleGroup: 'chest',
      equipment: 'dumbbell',
      difficulty: 'intermediate',
      reason: 'מתיחה עמוקה של החזה בתחתית התנועה עם ציוד פשוט',
    },
  ],
  'פרפר במכונה (פק דק)': [
    {
      id: 'alt-cable-fly',
      name: 'פרפר בכבלים',
      nameEn: 'Cable Fly',
      muscleGroup: 'chest',
      equipment: 'cable',
      difficulty: 'intermediate',
      reason: 'מתח קבוע לאורך כל הטווח וגמישות בזווית העבודה',
    },
    {
      id: 'alt-dumbbell-fly-2',
      name: 'פרפר עם משקולות',
      nameEn: 'Dumbbell Fly',
      muscleGroup: 'chest',
      equipment: 'dumbbell',
      difficulty: 'intermediate',
      reason: 'מתיחה עמוקה של החזה בתחתית התנועה עם ציוד פשוט',
    },
  ],
  'סקוואט מוט': [
    {
      id: 'alt-leg-press',
      name: 'לחיצת רגליים במכונה',
      nameEn: 'Leg Press',
      muscleGroup: 'quads',
      equipment: 'machine',
      difficulty: 'beginner',
      reason: 'מפחית עומס על הגב התחתון ומאפשר שליטה טובה יותר בטווח התנועה',
    },
    {
      id: 'alt-hack-squat',
      name: 'האק סקוואט',
      nameEn: 'Hack Squat',
      muscleGroup: 'quads',
      equipment: 'machine',
      difficulty: 'intermediate',
      reason: 'בידוד מקסימלי לארבע-ראשי עם תמיכה מלאה בגב לאורך כל התנועה',
    },
    {
      id: 'alt-bulgarian-split-squat',
      name: 'מכרעים בולגריים',
      nameEn: 'Bulgarian Split Squat',
      muscleGroup: 'glutes',
      equipment: 'dumbbell',
      difficulty: 'intermediate',
      reason: 'בונה יציבות חד-רגלית ומאזן פערי כוח בין הרגליים',
    },
    {
      id: 'alt-goblet-squat',
      name: 'גובלט סקוואט',
      nameEn: 'Goblet Squat',
      muscleGroup: 'quads',
      equipment: 'dumbbell',
      difficulty: 'beginner',
      reason: 'קל ללימוד, שומר על גב זקוף ומתאים למתחילים',
    },
  ],
  'לחיצת רגליים במכונה': [
    {
      id: 'alt-back-squat',
      name: 'סקוואט מוט',
      nameEn: 'Back Squat',
      muscleGroup: 'quads',
      equipment: 'barbell',
      difficulty: 'intermediate',
      reason: 'תרגיל מורכב שמפעיל טווח שרירים רחב יותר, כולל ליבה וגב תחתון',
      repsRange: '6-8',
    },
    {
      id: 'alt-hack-squat-2',
      name: 'האק סקוואט',
      nameEn: 'Hack Squat',
      muscleGroup: 'quads',
      equipment: 'machine',
      difficulty: 'intermediate',
      reason: 'בידוד מקסימלי לארבע-ראשי עם תמיכה מלאה בגב',
    },
    {
      id: 'alt-goblet-squat-2',
      name: 'גובלט סקוואט',
      nameEn: 'Goblet Squat',
      muscleGroup: 'quads',
      equipment: 'dumbbell',
      difficulty: 'beginner',
      reason: 'קל ללימוד, שומר על גב זקוף ומתאים למתחילים',
    },
  ],
  'לחיצת חזה במוט שטוח': [
    {
      id: 'alt-dumbbell-bench-press',
      name: 'לחיצת חזה עם משקולות',
      nameEn: 'Dumbbell Bench Press',
      muscleGroup: 'chest',
      equipment: 'dumbbell',
      difficulty: 'intermediate',
      reason: 'טווח תנועה גדול יותר ומאזן פערי כוח בין הצדדים',
    },
    {
      id: 'alt-chest-press-machine',
      name: 'לחיצת חזה במכונה',
      nameEn: 'Chest Press Machine',
      muscleGroup: 'chest',
      equipment: 'machine',
      difficulty: 'beginner',
      reason: 'מסלול תנועה קבוע ובטוח, אידיאלי כשמתאמנים לבד',
    },
    {
      id: 'alt-incline-dumbbell-press',
      name: 'לחיצת חזה בשיפוע עם משקולות',
      nameEn: 'Incline Dumbbell Press',
      muscleGroup: 'chest',
      equipment: 'dumbbell',
      difficulty: 'intermediate',
      reason: 'מוסיף דגש על החזה העליון לצד פחות עומס על הכתף',
    },
    {
      id: 'alt-weighted-pushups',
      name: 'שכיבות סמיכה עם משקל',
      nameEn: 'Weighted Push-ups',
      muscleGroup: 'chest',
      equipment: 'bodyweight',
      difficulty: 'beginner',
      reason: 'תרגיל נגיש שלא דורש ציוד ומחזק גם את הליבה',
    },
  ],
  'דדליפט רומני': [
    {
      id: 'alt-dumbbell-rdl',
      name: 'דדליפט רומני עם משקולות',
      nameEn: 'Dumbbell RDL',
      muscleGroup: 'hamstrings',
      equipment: 'dumbbell',
      difficulty: 'beginner',
      reason: 'קל יותר ללימוד הטכניקה ומפחית עומס על הגב התחתון',
    },
    {
      id: 'alt-back-extension',
      name: 'פשיטת גו בכיסא רומי',
      nameEn: 'Back Extension',
      muscleGroup: 'hamstrings',
      equipment: 'machine',
      difficulty: 'beginner',
      reason: 'מבודד את ההמסטרינג והגב התחתון עם סיכון נמוך לטכניקה שגויה',
    },
    {
      id: 'alt-lying-leg-curl',
      name: 'כפיפת ברך שכיבה',
      nameEn: 'Lying Leg Curl',
      muscleGroup: 'hamstrings',
      equipment: 'machine',
      difficulty: 'beginner',
      reason: 'בידוד מלא של ההמסטרינג ללא מעורבות הגב התחתון',
    },
  ],
  'מתח באחיזה רחבה (או מכונת עזר)': [
    {
      id: 'alt-lat-pulldown',
      name: 'פולי עליון לגב רחב',
      nameEn: 'Lat Pulldown',
      muscleGroup: 'back',
      equipment: 'cable',
      difficulty: 'beginner',
      reason: 'מאפשר שליטה במשקל ומתאים למי שעדיין לא מגיע למתח מלא',
    },
    {
      id: 'alt-assisted-pullup',
      name: 'מתח בגומייה או בגרביטון',
      nameEn: 'Assisted Pull-up',
      muscleGroup: 'back',
      equipment: 'machine',
      difficulty: 'beginner',
      reason: 'עוזר לבנות כוח בהדרגה עם תמיכה חלקית במשקל הגוף',
    },
    {
      id: 'alt-narrow-pullup',
      name: 'מתח באחיזה צרה',
      nameEn: 'Close-grip Pull-up',
      muscleGroup: 'back',
      equipment: 'bodyweight',
      difficulty: 'advanced',
      reason: 'מדגיש יותר את הגב האמצעי והביצפס תוך שמירה על תבנית תנועה זהה',
    },
  ],
  'לחיצת כתפיים בעמידה': [
    {
      id: 'alt-dumbbell-shoulder-press',
      name: 'לחיצת כתפיים עם משקולות',
      nameEn: 'Dumbbell Shoulder Press',
      muscleGroup: 'shoulders',
      equipment: 'dumbbell',
      difficulty: 'beginner',
      reason: 'טווח תנועה טבעי יותר לכתף ומאזן פערי כוח בין הצדדים',
    },
    {
      id: 'alt-incline-shoulder-press-machine',
      name: 'לחיצת כתפיים בשיפוע (מכונה)',
      nameEn: 'Machine Shoulder Press',
      muscleGroup: 'shoulders',
      equipment: 'machine',
      difficulty: 'beginner',
      reason: 'מסלול תנועה קבוע שמפחית עומס על הגב התחתון',
    },
    {
      id: 'alt-arnold-press',
      name: 'לחיצה ארנולד',
      nameEn: 'Arnold Press',
      muscleGroup: 'shoulders',
      equipment: 'dumbbell',
      difficulty: 'advanced',
      reason: 'משלב סיבוב כף היד שמגייס את הכתף הקדמית והצדדית בו-זמנית',
    },
  ],
  'חתירת מוט חבוק': [
    {
      id: 'alt-seated-cable-row',
      name: 'חתירה בכבל ישיבה',
      nameEn: 'Seated Cable Row',
      muscleGroup: 'back',
      equipment: 'cable',
      difficulty: 'beginner',
      reason: 'מסלול תנועה קבוע שמפחית עומס על הגב התחתון',
    },
    {
      id: 'alt-t-bar-row',
      name: 'חתירת T או חתירת מוט',
      nameEn: 'T-Bar Row',
      muscleGroup: 'back',
      equipment: 'barbell',
      difficulty: 'intermediate',
      reason: 'עומס כבד יותר עם דגש על עובי הגב האמצעי',
    },
    {
      id: 'alt-one-arm-dumbbell-row',
      name: 'חתירת דאמבל חד-יד',
      nameEn: 'One-arm Dumbbell Row',
      muscleGroup: 'back',
      equipment: 'dumbbell',
      difficulty: 'beginner',
      reason: 'טווח תנועה גדול יותר ותיקון פערי כוח בין הצדדים',
    },
  ],
};

type CompactAlternative = [
  name: string,
  nameEn: string,
  muscleGroup: MuscleGroup,
  equipment: Equipment,
  difficulty: ExerciseDifficulty,
  reason: string,
];

/**
 * Alternatives for every remaining template exercise, in a compact tuple form. Each entry shares the source exercise's
 * primary muscle and a similar movement pattern. Names that already exist as template exercises reuse their real demo
 * video at swap time; new ones deliberately carry no video id (the player falls back to a YouTube search).
 */
const COMPACT_ALTERNATIVES: Record<string, CompactAlternative[]> = {
  'לחיצת חזה בשיפוע עם משקולות': [
    ['לחיצת חזה בשיפוע במכונה', 'Incline Machine Chest Press', 'chest', 'machine', 'beginner', 'מסלול יציב שמאפשר להתמקד בחזה העליון בלי לאזן משקולות'],
    ['לחיצת חזה בשיפוע עם מוט', 'Incline Barbell Bench Press', 'chest', 'barbell', 'intermediate', 'מאפשר להעמיס יותר משקל על החזה העליון והכתפיים הקדמיות'],
    ['שכיבות סמיכה בשיפוע חיובי', 'Incline Push-Up', 'chest', 'bodyweight', 'beginner', 'אפשרות ללא ציוד שמדגישה את החזה התחתון והאמצעי'],
  ],
  'מכרעים הליכה': [
    ['מכרעים בולגריים', 'Bulgarian Split Squat', 'glutes', 'dumbbell', 'intermediate', 'בונה יציבות חד-רגלית עם דגש חזק על הישבן והארבע-ראשי'],
    ['מכרעים במקום', 'Reverse Lunge', 'glutes', 'dumbbell', 'beginner', 'יציב יותר מהליכה ועדין יותר לברכיים'],
    ['פשיטת ברך במכונה', 'Leg Extension', 'quads', 'machine', 'beginner', 'בידוד של הארבע-ראשי בלי דרישת שיווי משקל'],
  ],
  'מכרעים בולגריים': [
    ['מכרעים הליכה', 'Walking Lunges', 'glutes', 'dumbbell', 'intermediate', 'עבודה דינמית על כל הרגל עם עומס מטבולי גבוה'],
    ['מכרעים במקום', 'Reverse Lunge', 'quads', 'dumbbell', 'beginner', 'קל לשליטה וקל יותר לברכיים'],
    ['גובלט סקוואט', 'Goblet Squat', 'quads', 'dumbbell', 'beginner', 'סקוואט דו-רגלי יציב שקל ללמוד'],
  ],
  'לחיצת כתפיים בשיפוע (מכונה)': [
    ['לחיצת כתפיים עם משקולות', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell', 'intermediate', 'טווח תנועה חופשי ועבודה שווה על שתי הכתפיים'],
    ['לחיצה ארנולד', 'Arnold Press', 'shoulders', 'dumbbell', 'intermediate', 'סיבוב שמפעיל את כל ראשי הכתף לאורך התנועה'],
    ['לחיצת כתפיים בעמידה', 'Standing Barbell Overhead Press', 'shoulders', 'barbell', 'advanced', 'תרגיל בסיס כבד שמחזק גם את הליבה'],
  ],
  'חתירה בכבל ישיבה': [
    ['חתירת דאמבל חד-יד', 'One-Arm Dumbbell Row', 'back', 'dumbbell', 'beginner', 'טווח תנועה גדול ותיקון פערי כוח בין הצדדים'],
    ['חתירת T או חתירת מוט', 'T-Bar Row', 'back', 'barbell', 'intermediate', 'מאפשר להעמיס משקל כבד על אמצע הגב'],
    ['חתירה במכונה בישיבה', 'Seated Machine Row', 'back', 'machine', 'beginner', 'תמיכה בחזה מורידה עומס מהגב התחתון'],
  ],
  'חתירת T או חתירת מוט': [
    ['חתירה בכבל ישיבה', 'Seated Cable Row', 'back', 'cable', 'beginner', 'מתח קבוע על הגב ועומס מינימלי על הגב התחתון'],
    ['חתירת דאמבל חד-יד', 'One-Arm Dumbbell Row', 'back', 'dumbbell', 'beginner', 'ליבה יציבה יותר וטווח תנועה גדול'],
    ['חתירת מוט חבוק', 'Bent Over Barbell Row', 'back', 'barbell', 'intermediate', 'תרגיל בסיס קלאסי לעובי הגב'],
  ],
  'חתירת דאמבל חד-יד': [
    ['חתירה בכבל ישיבה', 'Seated Cable Row', 'back', 'cable', 'beginner', 'מתח קבוע על הגב לאורך כל התנועה'],
    ['חתירת T או חתירת מוט', 'T-Bar Row', 'back', 'barbell', 'intermediate', 'עומס כבד יותר על אמצע הגב'],
    ['חתירה במכונה בישיבה', 'Seated Machine Row', 'back', 'machine', 'beginner', 'מסלול קבוע ללא צורך בשיווי משקל'],
  ],
  'מתח באחיזה צרה': [
    ['פולי עליון לגב רחב', 'Lat Pulldown', 'back', 'cable', 'beginner', 'אותה תנועת משיכה אנכית עם עומס שאפשר להתאים בדיוק'],
    ['מתח בגומייה או בגרביטון', 'Assisted Pull-Up', 'back', 'bodyweight', 'beginner', 'מאפשר לבצע מתח עם עזרה עד שהכוח משתפר'],
    ['פולי עליון באחיזה צרה', 'Close Grip Lat Pulldown', 'back', 'cable', 'beginner', 'מדגיש את החלק התחתון של הגב הרחב'],
  ],
  'פולי עליון לגב רחב': [
    ['מתח באחיזה רחבה (או מכונת עזר)', 'Wide Grip Pull-up', 'back', 'bodyweight', 'advanced', 'תרגיל משקל גוף שמפתח כוח משיכה פונקציונלי'],
    ['מתח בגומייה או בגרביטון', 'Assisted Pull-Up', 'back', 'bodyweight', 'beginner', 'גרסה מסייעת לאותה תנועה'],
    ['פולי עליון באחיזה צרה', 'Close Grip Lat Pulldown', 'back', 'cable', 'beginner', 'שינוי זווית שמדגיש את החלק התחתון של הגב הרחב'],
  ],
  'כפיפת מרפק במוט': [
    ['כפיפת מרפק בפולי', 'Cable Bicep Curl', 'biceps', 'cable', 'beginner', 'מתח קבוע על הדו-ראשי לאורך כל הטווח'],
    ['כפיפת מרפק עם משקולות', 'Dumbbell Bicep Curl', 'biceps', 'dumbbell', 'beginner', 'כל יד עובדת בנפרד ומתקנת פערי כוח'],
    ['כפיפת מרפק פטיש', 'Dumbbell Hammer Curl', 'biceps', 'dumbbell', 'beginner', 'מדגיש גם את שריר הזרוע הקדמית'],
  ],
  'כפיפת מרפק בפולי': [
    ['כפיפת מרפק במוט', 'Barbell Curl', 'biceps', 'barbell', 'intermediate', 'מאפשר להעמיס יותר משקל על הדו-ראשי'],
    ['כפיפת מרפק עם משקולות', 'Dumbbell Bicep Curl', 'biceps', 'dumbbell', 'beginner', 'סיבוב מפרק כף היד לכיווץ מלא יותר'],
    ['כפיפת מרפק פטיש', 'Dumbbell Hammer Curl', 'biceps', 'dumbbell', 'beginner', 'מדגיש את הזרוע הקדמית ואת הברכיאליס'],
  ],
  'כפיפת מרפק פטיש': [
    ['כפיפת מרפק עם משקולות', 'Dumbbell Bicep Curl', 'biceps', 'dumbbell', 'beginner', 'ריכוז על הדו-ראשי עם סיבוב כף היד'],
    ['כפיפת מרפק בפולי', 'Cable Bicep Curl', 'biceps', 'cable', 'beginner', 'מתח קבוע לכל אורך התנועה'],
    ['כפיפת מרפק במוט', 'Barbell Curl', 'biceps', 'barbell', 'intermediate', 'עומס כבד יותר על הדו-ראשי'],
  ],
  'פשיטת מרפק בפולי': [
    ['פשיטת מרפק מעל הראש', 'Overhead Triceps Extension', 'triceps', 'dumbbell', 'intermediate', 'מתיחה מלאה של הראש הארוך של הטריצפס'],
    ['פשיטת מרפק בכבל בחבל', 'Rope Triceps Pushdown', 'triceps', 'cable', 'beginner', 'החבל מאפשר פשיטה מלאה והפרדה בסוף התנועה'],
    ['שכיבות סמיכה צרות', 'Close Grip Push-Up', 'triceps', 'bodyweight', 'beginner', 'אפשרות ללא ציוד שמעמיסה על הטריצפס'],
  ],
  'פשיטת מרפק מעל הראש': [
    ['פשיטת מרפק בפולי', 'Cable Triceps Pushdown', 'triceps', 'cable', 'beginner', 'מתח קבוע על הטריצפס ועומס קל על המרפקים'],
    ['פשיטת מרפק בכבל מעל הראש', 'Cable Overhead Triceps Extension', 'triceps', 'cable', 'intermediate', 'אותה מתיחה מלאה עם מתח קבוע בכל הטווח'],
    ['שכיבות סמיכה צרות', 'Close Grip Push-Up', 'triceps', 'bodyweight', 'beginner', 'אפשרות ללא ציוד שמעמיסה על הטריצפס'],
  ],
  'הרחקת כתפיים לצד': [
    ['הרחקת כתפיים בכבל', 'Cable Lateral Raise', 'shoulders', 'cable', 'intermediate', 'מתח קבוע על הכתף האמצעית גם בתחתית התנועה'],
    ['הרחקת כתפיים במכונה', 'Machine Lateral Raise', 'shoulders', 'machine', 'beginner', 'מסלול קבוע שמתמקד בכתף האמצעית'],
    ['משיכת מוט לסנטר', 'Upright Row', 'shoulders', 'barbell', 'intermediate', 'מפעיל את הכתף האמצעית והטרפז העליון'],
  ],
  'כפיפת ברך שכיבה': [
    ['כפיפת ברך בישיבה במכונה', 'Seated Leg Curl', 'hamstrings', 'machine', 'beginner', 'מתיחה גדולה יותר של הירך האחורית בטווח התנועה'],
    ['דדליפט רומני עם משקולות', 'Dumbbell Romanian Deadlift', 'hamstrings', 'dumbbell', 'intermediate', 'מדגיש את הירך האחורית בתנועת ציר אגן'],
    ['כפיפת ברך בעמידה בכבל', 'Standing Cable Leg Curl', 'hamstrings', 'cable', 'beginner', 'עבודה חד-רגלית לבידוד הירך האחורית'],
  ],
  'פשיטת ברך במכונה': [
    ['גובלט סקוואט', 'Goblet Squat', 'quads', 'dumbbell', 'beginner', 'עבודה על הארבע-ראשי בתנועה מורכבת'],
    ['מכרעים במקום', 'Reverse Lunge', 'quads', 'dumbbell', 'beginner', 'הארבע-ראשי עובד בתנועה חד-רגלית'],
    ['לחיצת רגליים במכונה', 'Leg Press', 'quads', 'machine', 'beginner', 'עומס כבד על הארבע-ראשי עם תמיכה בגב'],
  ],
  'הרמת אגן (Hip Thrust)': [
    ['גשר ישבן', 'Glute Bridge', 'glutes', 'bodyweight', 'beginner', 'אותה תנועה בעומס קל יותר וללא ציוד'],
    ['הרמת אגן במכונה', 'Machine Hip Thrust', 'glutes', 'machine', 'beginner', 'הציוד מייצב את התנועה ומקל על ההעמסה'],
    ['הרמת אגן עם משקולת', 'Dumbbell Hip Thrust', 'glutes', 'dumbbell', 'beginner', 'גרסה נגישה כשאין מוט'],
  ],
  'הרמת שוקיים בעמידה': [
    ['הרמת שוקיים בישיבה', 'Seated Calf Raise', 'calves', 'machine', 'beginner', 'מדגיש את שריר הסוליאוס'],
    ['הרמת שוקיים בלחיצת רגליים', 'Leg Press Calf Raise', 'calves', 'machine', 'beginner', 'עומס כבד ויציב על השוקיים'],
    ['הרמת שוקיים חד-רגלית', 'Single-Leg Calf Raise', 'calves', 'bodyweight', 'beginner', 'אפשרות ללא ציוד עם טווח תנועה מלא'],
  ],
  'הרמת שוקיים בישיבה': [
    ['הרמת שוקיים בעמידה', 'Standing Calf Raise', 'calves', 'machine', 'beginner', 'מדגיש את שריר התאומים'],
    ['הרמת שוקיים בלחיצת רגליים', 'Leg Press Calf Raise', 'calves', 'machine', 'beginner', 'עומס כבד ויציב על השוקיים'],
    ['הרמת שוקיים חד-רגלית', 'Single-Leg Calf Raise', 'calves', 'bodyweight', 'beginner', 'אפשרות ללא ציוד עם טווח תנועה מלא'],
  ],
  'פלאנק': [
    ['פלאנק צידי', 'Side Plank', 'core', 'bodyweight', 'beginner', 'מדגיש את שרירי הבטן הצידיים'],
    ['הרמת ברכיים תלויה', 'Hanging Knee Raise', 'core', 'bodyweight', 'intermediate', 'מחזק את הבטן התחתונה ואת מכופפי הירך'],
    ['כפיפות בטן עם משקל', 'Weighted Crunch', 'core', 'bodyweight', 'beginner', 'מעמיס ישירות על שריר הבטן הישר'],
  ],
  'פלאנק צידי': [
    ['פלאנק', 'Plank', 'core', 'bodyweight', 'beginner', 'מייצב את כל הליבה'],
    ['הרמת ברכיים תלויה', 'Hanging Knee Raise', 'core', 'bodyweight', 'intermediate', 'מחזק את הבטן התחתונה'],
    ['כפיפות בטן עם משקל', 'Weighted Crunch', 'core', 'bodyweight', 'beginner', 'מעמיס ישירות על שריר הבטן הישר'],
  ],
  'כפיפות בטן עם משקל': [
    ['הרמת ברכיים תלויה', 'Hanging Knee Raise', 'core', 'bodyweight', 'intermediate', 'מחזק את הבטן התחתונה'],
    ['פלאנק', 'Plank', 'core', 'bodyweight', 'beginner', 'מייצב את כל הליבה'],
    ['כפיפות בטן בכבל', 'Cable Crunch', 'core', 'cable', 'intermediate', 'מאפשר עומס מתקדם על שריר הבטן'],
  ],
  'הרמת ברכיים תלויה': [
    ['הרמת רגליים בשכיבה', 'Lying Leg Raise', 'core', 'bodyweight', 'beginner', 'גרסה קלה יותר בלי תלייה'],
    ['כפיפות בטן עם משקל', 'Weighted Crunch', 'core', 'bodyweight', 'beginner', 'מעמיס ישירות על שריר הבטן הישר'],
    ['פלאנק', 'Plank', 'core', 'bodyweight', 'beginner', 'מייצב את כל הליבה'],
  ],
};

/** Builds the full alternatives map: the hand-written base entries plus the compact entries above for exercises that lacked any. */
const EXERCISE_ALTERNATIVES: Record<string, ExerciseAlternative[]> = (() => {
  const merged: Record<string, ExerciseAlternative[]> = { ...BASE_ALTERNATIVES };
  let counter = 0;
  for (const [exerciseName, list] of Object.entries(COMPACT_ALTERNATIVES)) {
    if (merged[exerciseName] || list.length === 0) continue;
    merged[exerciseName] = list.map(([name, nameEn, muscleGroup, equipment, difficulty, reason]) => {
      counter += 1;
      return { id: `alt-bank-${counter}`, name, nameEn, muscleGroup, equipment, difficulty, reason };
    });
  }
  return merged;
})();

// ---------------------------------------------------------------------------
// Exercise factory
// ---------------------------------------------------------------------------

/** English name for every template exercise, keyed by its Hebrew name (swap-only alternatives carry their own `nameEn`). */
const EXERCISE_NAMES_EN: Record<string, string> = {
  'סקוואט מוט': 'Barbell Back Squat',
  'פרפר בכבלים': 'Cable Fly',
  'פרפר במכונה (פק דק)': 'Pec Deck Fly',
  'דדליפט רומני': 'Romanian Deadlift',
  'לחיצת חזה במוט שטוח': 'Barbell Bench Press',
  'לחיצת חזה בשיפוע עם משקולות': 'Incline Dumbbell Press',
  'לחיצת כתפיים בעמידה': 'Standing Barbell Overhead Press',
  'לחיצת כתפיים בשיפוע (מכונה)': 'Machine Shoulder Press',
  'לחיצת רגליים במכונה': 'Leg Press',
  'חתירה בכבל ישיבה': 'Seated Cable Row',
  'חתירת T או חתירת מוט': 'T-Bar Row',
  'חתירת מוט חבוק': 'Bent Over Barbell Row',
  'מתח באחיזה רחבה (או מכונת עזר)': 'Wide Grip Pull-up',
  'מתח באחיזה צרה': 'Close Grip Pull-up',
  'פולי עליון לגב רחב': 'Lat Pulldown',
  'כפיפת מרפק במוט': 'Barbell Curl',
  'כפיפת מרפק בפולי': 'Cable Bicep Curl',
  'כפיפת מרפק פטיש': 'Dumbbell Hammer Curl',
  'פשיטת מרפק בפולי': 'Cable Triceps Pushdown',
  'פשיטת מרפק מעל הראש': 'Overhead Triceps Extension',
  'הרחקת כתפיים לצד': 'Dumbbell Lateral Raise',
  'כפיפת ברך שכיבה': 'Lying Leg Curl',
  'פשיטת ברך במכונה': 'Leg Extension',
  'הרמת אגן (Hip Thrust)': 'Barbell Hip Thrust',
  'מכרעים בולגריים': 'Bulgarian Split Squat',
  'מכרעים הליכה': 'Walking Lunges',
  'הרמת שוקיים בעמידה': 'Standing Calf Raise',
  'הרמת שוקיים בישיבה': 'Seated Calf Raise',
  פלאנק: 'Plank',
  'פלאנק צידי': 'Side Plank',
  'כפיפות בטן עם משקל': 'Weighted Crunch',
  'הרמת ברכיים תלויה': 'Hanging Knee Raise',
};

/** English name for an exercise by its Hebrew name - from the template library or the swap alternatives. Undefined if unknown. */
export function getExerciseNameEn(name: string): string | undefined {
  if (EXERCISE_NAMES_EN[name]) return EXERCISE_NAMES_EN[name];
  for (const list of Object.values(EXERCISE_ALTERNATIVES)) {
    const found = list.find((alt) => alt.name === name);
    if (found) return found.nameEn;
  }
  return undefined;
}

/** Exercises the personalization engine can add to a plan although no base template contains them. */
const EXTRA_EXERCISES: Record<string, { muscleGroup: MuscleGroup; equipment: Equipment }> = {
  'הרמת אגן (Hip Thrust)': { muscleGroup: 'glutes', equipment: 'barbell' },
};

let exerciseCounter = 0;

function ex(
  name: string,
  muscleGroup: MuscleGroup,
  equipment: Equipment,
  sets: number,
  repsRange: string,
  restSeconds: number,
  notes?: string,
): Exercise {
  exerciseCounter += 1;
  const media = EXERCISE_MEDIA[name];
  return {
    id: `ex-${exerciseCounter}-${name.replace(/\s+/g, '-')}`,
    name,
    nameEn: EXERCISE_NAMES_EN[name],
    muscleGroup,
    equipment,
    sets,
    repsRange,
    restSeconds,
    notes,
    youtubeId: media?.youtubeId,
    cues: media?.cues,
    alternatives: EXERCISE_ALTERNATIVES[name],
  };
}

/** Builds a session with its exercises clustered by muscle block; `blockOrder` puts the session's emphasis first. */
function day(id: string, dayLabel: string, focus: string, exercises: Exercise[], blockOrder?: ExerciseBlock[]): DayWorkout {
  return { id, dayLabel, focus, exercises: orderExercisesByBlock(exercises, { blockOrder }) };
}

// ---------------------------------------------------------------------------
// Full Body Workout (FBW) — 3 days/week
// ---------------------------------------------------------------------------

/**
 * Sessions are named A/B/C, not by weekday: the user decides which calendar day each one lands on (the calendar screen
 * schedules them). Full-body sessions hit every major muscle each time, so a rest day between them is recommended
 * (see getFrequencyRecommendation) but never enforced.
 *
 * Each big muscle (chest, back, quads, hamstrings) is trained all three days with ONE focused exercise per session of
 * 4 sets, which lands every one of them at exactly 12 direct sets a week - the bottom of the 12-16 target - while a session
 * stays at about 22 sets and never stacks more than 4 sets on a muscle.
 */
function buildFbwDays(): DayWorkout[] {
  return [
    day('fbw-a', 'אימון A', 'גוף מלא - דגש רגליים וחזה', [
      ex('סקוואט מוט', 'quads', 'barbell', 4, '6-8', 120, 'תרגיל מרכזי, חימום הדרגתי'),
      ex('לחיצת חזה במוט שטוח', 'chest', 'barbell', 4, '6-10', 120),
      ex('חתירה בכבל ישיבה', 'back', 'cable', 4, '10-12', 90),
      ex('כפיפת ברך שכיבה', 'hamstrings', 'machine', 4, '10-12', 75),
      ex('הרחקת כתפיים לצד', 'shoulders', 'dumbbell', 3, '12-15', 60),
      ex('כפיפת מרפק בפולי', 'biceps', 'cable', 3, '10-12', 60),
    ]),
    day('fbw-b', 'אימון B', 'גוף מלא - דגש גב ורגליים אחוריים', [
      ex('דדליפט רומני', 'hamstrings', 'barbell', 4, '8-10', 120, 'שמירה על גב ישר לאורך כל הטווח'),
      ex('מתח באחיזה רחבה (או מכונת עזר)', 'back', 'bodyweight', 4, '8-10', 120),
      ex('לחיצת חזה בשיפוע עם משקולות', 'chest', 'dumbbell', 4, '8-12', 90),
      ex('מכרעים בולגריים', 'quads', 'dumbbell', 4, '10-12 לכל רגל', 90),
      ex('פשיטת מרפק בפולי', 'triceps', 'cable', 3, '10-12', 60),
      ex('כפיפות בטן עם משקל', 'core', 'bodyweight', 3, '12-15', 45),
    ], ['pull', 'push', 'legs']),
    day('fbw-c', 'אימון C', 'גוף מלא - דגש כוח כללי', [
      ex('לחיצת רגליים במכונה', 'quads', 'machine', 4, '10-12', 90),
      ex('חתירת T או חתירת מוט', 'back', 'barbell', 4, '8-12', 90),
      ex('פרפר בכבלים', 'chest', 'cable', 4, '10-12', 75),
      ex('הרחקת כתפיים לצד', 'shoulders', 'dumbbell', 4, '12-15', 60),
      ex('כפיפת ברך שכיבה', 'hamstrings', 'machine', 4, '10-12', 75),
      ex('הרמת ברכיים תלויה', 'core', 'bodyweight', 3, '10-15', 45),
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Shared upper / lower / push / pull / legs sessions
// ---------------------------------------------------------------------------
//
// Every session below follows the same architecture: two different exercises for each big muscle that is
// trained (a heavy compound + a complementary angle/isolation, 6-7 sets together), a lateral-raise for the
// side delts, and 3 focused sets per arm. Variant "a" and "b" swap the exercises for the same slots, so a
// muscle trained twice a week sees different angles (exercise variation) rather than the same lifts twice.

type SessionVariant = 'a' | 'b';

/** Chest: heavy press + a fly-type movement under stretch (7 sets). Back: vertical + horizontal pull (6-7 sets). */
function upperSession(id: string, label: string, focus: string, variant: SessionVariant): DayWorkout {
  const isA = variant === 'a';
  return day(id, label, focus, [
    // Chest
    isA
      ? ex('לחיצת חזה במוט שטוח', 'chest', 'barbell', 4, '6-10', 120)
      : ex('לחיצת חזה בשיפוע עם משקולות', 'chest', 'dumbbell', 4, '8-10', 90),
    isA
      ? ex('פרפר בכבלים', 'chest', 'cable', 3, '10-12', 75)
      : ex('פרפר במכונה (פק דק)', 'chest', 'machine', 3, '10-12', 75),
    // Back: vertical then horizontal
    isA
      ? ex('מתח באחיזה רחבה (או מכונת עזר)', 'back', 'bodyweight', 4, '8-10', 120)
      : ex('פולי עליון לגב רחב', 'back', 'cable', 3, '8-10', 90),
    isA
      ? ex('חתירת מוט חבוק', 'back', 'barbell', 3, '8-12', 90)
      : ex('חתירה בכבל ישיבה', 'back', 'cable', 3, '10-12', 90),
    // Side delts (an overhead press alone doesn't train them)
    ex('הרחקת כתפיים לצד', 'shoulders', 'dumbbell', isA ? 4 : 3, '10-15', 60),
    // Arms: 3 focused sets each
    isA ? ex('כפיפת מרפק במוט', 'biceps', 'barbell', 3, '8-12', 60) : ex('כפיפת מרפק פטיש', 'biceps', 'dumbbell', 3, '10-12', 60),
    isA
      ? ex('פשיטת מרפק מעל הראש', 'triceps', 'dumbbell', 3, '10-12', 60)
      : ex('פשיטת מרפק בפולי', 'triceps', 'cable', 3, '10-12', 60),
  ]);
}

/**
 * Knee-dominant compound, a quad accessory, TWO hamstring movements (a hip hinge and a leg curl - one lift alone left the hamstrings
 * at about 6 weekly sets), plus calves and core. Over two leg sessions: quads 14, hamstrings 13 sets a week.
 */
function lowerSession(id: string, label: string, focus: string, variant: SessionVariant): DayWorkout {
  const isA = variant === 'a';
  return day(id, label, focus, [
    isA
      ? ex('סקוואט מוט', 'quads', 'barbell', 4, '6-8', 150, 'תרגיל מרכזי')
      : ex('לחיצת רגליים במכונה', 'quads', 'machine', 4, '8-10', 120),
    isA ? ex('דדליפט רומני', 'hamstrings', 'barbell', 4, '6-8', 120) : ex('דדליפט רומני', 'hamstrings', 'barbell', 3, '10-12', 90),
    isA ? ex('כפיפת ברך שכיבה', 'hamstrings', 'machine', 3, '10-12', 75) : ex('כפיפת ברך שכיבה', 'hamstrings', 'machine', 3, '10-12', 90),
    isA
      ? ex('פשיטת ברך במכונה', 'quads', 'machine', 3, '12-15', 60)
      : ex('מכרעים בולגריים', 'quads', 'dumbbell', 3, '10-12 לכל רגל', 90), // quad-dominant single-leg squat (glutes assist)
    isA
      ? ex('הרמת שוקיים בעמידה', 'calves', 'machine', 3, '10-15', 60)
      : ex('הרמת שוקיים בישיבה', 'calves', 'machine', 3, '12-20', 60),
    isA
      ? ex('פלאנק צידי', 'core', 'bodyweight', 3, '30-40 שניות לכל צד', 45)
      : ex('כפיפות בטן עם משקל', 'core', 'bodyweight', 3, '12-15', 45),
  ]);
}

// ---------------------------------------------------------------------------
// Upper / Lower — 4 days/week ("AB" split)
// ---------------------------------------------------------------------------
//
// Each big muscle is trained twice a week with 6-7 sets per session -> 13-14 sets/week (chest 14, back 13, quads 14, hamstrings 13).

function buildUpperLowerDays(): DayWorkout[] {
  return [
    upperSession('ul-upper-a', 'אימון A1 (פלג גוף עליון)', 'פלג גוף עליון - כוח', 'a'),
    lowerSession('ul-lower-a', 'אימון B1 (פלג גוף תחתון)', 'פלג גוף תחתון - כוח', 'a'),
    upperSession('ul-upper-b', 'אימון A2 (פלג גוף עליון)', 'פלג גוף עליון - נפח', 'b'),
    lowerSession('ul-lower-b', 'אימון B2 (פלג גוף תחתון)', 'פלג גוף תחתון - נפח', 'b'),
  ];
}

// ---------------------------------------------------------------------------
// Push / Pull / Legs — 5 or 6 days/week
// ---------------------------------------------------------------------------

function buildPushDay(id: string, label: string, variant: SessionVariant): DayWorkout {
  const isA = variant === 'a';
  return day(id, label, 'דחיפה - חזה, כתפיים, טריצפס', [
    isA
      ? ex('לחיצת חזה במוט שטוח', 'chest', 'barbell', 4, '6-10', 120)
      : ex('לחיצת חזה בשיפוע עם משקולות', 'chest', 'dumbbell', 4, '8-10', 90),
    isA ? ex('פרפר בכבלים', 'chest', 'cable', 3, '10-12', 75) : ex('פרפר במכונה (פק דק)', 'chest', 'machine', 3, '10-12', 75),
    isA
      ? ex('לחיצת כתפיים בעמידה', 'shoulders', 'barbell', 3, '8-10', 90)
      : ex('לחיצת כתפיים בשיפוע (מכונה)', 'shoulders', 'machine', 3, '8-12', 90),
    ex('הרחקת כתפיים לצד', 'shoulders', 'dumbbell', 4, '10-15', 60),
    isA ? ex('פשיטת מרפק מעל הראש', 'triceps', 'dumbbell', 3, '10-12', 60) : ex('פשיטת מרפק בפולי', 'triceps', 'cable', 3, '10-12', 60),
    isA ? ex('פשיטת מרפק בפולי', 'triceps', 'cable', 3, '10-12', 60) : ex('פשיטת מרפק מעל הראש', 'triceps', 'dumbbell', 3, '10-12', 60),
  ]);
}

function buildPullDay(id: string, label: string, variant: SessionVariant): DayWorkout {
  const isA = variant === 'a';
  return day(id, label, 'משיכה - גב וביצפס', [
    isA
      ? ex('מתח באחיזה רחבה (או מכונת עזר)', 'back', 'bodyweight', 4, '8-10', 120)
      : ex('פולי עליון לגב רחב', 'back', 'cable', 4, '8-10', 90),
    isA ? ex('חתירת מוט חבוק', 'back', 'barbell', 3, '8-12', 90) : ex('חתירת T או חתירת מוט', 'back', 'barbell', 3, '8-12', 90),
    isA ? ex('כפיפת מרפק במוט', 'biceps', 'barbell', 3, '8-12', 60) : ex('כפיפת מרפק בפולי', 'biceps', 'cable', 3, '10-12', 60),
    ex('כפיפת מרפק פטיש', 'biceps', 'dumbbell', 3, '10-12', 60),
  ]);
}

function buildLegsDay(id: string, label: string, variant: SessionVariant): DayWorkout {
  return lowerSession(id, label, 'רגליים - ירך, ישבן ושוקיים', variant);
}

/** PPL5's fifth day: a compact upper session (same two-exercises-per-big-muscle structure) on the "b" variant. */
function buildUpperDay(id: string, label: string): DayWorkout {
  return upperSession(id, label, 'פלג גוף עליון - שילוב', 'b');
}

function buildPpl5Days(): DayWorkout[] {
  return [
    buildPushDay('ppl5-push', 'דחיפה (Push)', 'a'),
    buildPullDay('ppl5-pull', 'משיכה (Pull)', 'a'),
    buildLegsDay('ppl5-legs', 'רגליים (Legs)', 'a'),
    buildUpperDay('ppl5-upper', 'פלג גוף עליון'),
    lowerSession('ppl5-lower', 'פלג גוף תחתון', 'פלג גוף תחתון - שילוב', 'b'),
  ];
}

function buildPpl6Days(): DayWorkout[] {
  return [
    buildPushDay('ppl6-push-a', 'דחיפה (Push) 1', 'a'),
    buildPullDay('ppl6-pull-a', 'משיכה (Pull) 1', 'a'),
    buildLegsDay('ppl6-legs-a', 'רגליים (Legs) 1', 'a'),
    buildPushDay('ppl6-push-b', 'דחיפה (Push) 2', 'b'),
    buildPullDay('ppl6-pull-b', 'משיכה (Pull) 2', 'b'),
    buildLegsDay('ppl6-legs-b', 'רגליים (Legs) 2', 'b'),
  ];
}

// ---------------------------------------------------------------------------
// Public templates
// ---------------------------------------------------------------------------

export const WORKOUT_TEMPLATES: WorkoutPlan[] = [
  {
    id: 'fbw-3',
    splitType: 'fbw',
    daysPerWeek: 3,
    title: 'Full Body Workout',
    description: 'שלושה אימוני גוף מלא בשבוע - אידיאלי למתחילים ולמי שזמנו מוגבל.',
    days: buildFbwDays(),
  },
  {
    id: 'upper-lower-4',
    splitType: 'upper_lower',
    daysPerWeek: 4,
    title: 'Upper / Lower Split',
    description: 'ארבעה אימונים בשבוע המתחלקים בין פלג גוף עליון לתחתון, לתדירות ונפח מאוזנים.',
    days: buildUpperLowerDays(),
  },
  {
    id: 'ppl-5',
    splitType: 'ppl',
    daysPerWeek: 5,
    title: 'Push / Pull / Legs (5 ימים)',
    description: 'חמישה אימונים בשבוע בשילוב PPL עם יום עליון ותחתון נוסף, לרמות ביניים ומתקדמים.',
    days: buildPpl5Days(),
  },
  {
    id: 'ppl-6',
    splitType: 'ppl',
    daysPerWeek: 6,
    title: 'Push / Pull / Legs (6 ימים)',
    description: 'שישה אימונים בשבוע - שני מחזורי PPL מלאים, לנפח ותדירות גבוהים למתקדמים.',
    days: buildPpl6Days(),
  },
];

/** Picks the best-matching template for a given split type and weekly training frequency. */
export function getWorkoutTemplate(
  splitType: WorkoutSplitType,
  daysPerWeek: TrainingDaysPerWeek,
): WorkoutPlan {
  const exact = WORKOUT_TEMPLATES.find(
    (t) => t.splitType === splitType && t.daysPerWeek === daysPerWeek,
  );
  if (exact) return exact;

  // Fallback: closest day-count within the same split type.
  const sameSplit = WORKOUT_TEMPLATES.filter((t) => t.splitType === splitType);
  const pool = sameSplit.length > 0 ? sameSplit : WORKOUT_TEMPLATES;

  return pool.reduce((closest, current) =>
    Math.abs(current.daysPerWeek - daysPerWeek) < Math.abs(closest.daysPerWeek - daysPerWeek)
      ? current
      : closest,
  );
}

/** Suggests a sensible split type given the user's declared training frequency. */
export function suggestSplitType(daysPerWeek: TrainingDaysPerWeek): WorkoutSplitType {
  if (daysPerWeek <= 3) return 'fbw';
  if (daysPerWeek === 4) return 'upper_lower';
  return 'ppl';
}

/**
 * Looks up an exercise's canonical identity (muscle group, equipment, media) by name
 * anywhere in the template library. Used by the workout-adaptation engine to build
 * full Exercise records for substitutions/additions without duplicating exercise data.
 */
export function findExerciseTemplate(
  name: string,
): Pick<Exercise, 'name' | 'nameEn' | 'muscleGroup' | 'equipment' | 'youtubeId' | 'demoUrl' | 'cues'> | undefined {
  for (const plan of WORKOUT_TEMPLATES) {
    for (const day of plan.days) {
      const found = day.exercises.find((e) => e.name === name);
      if (found) {
        return {
          name: found.name,
          nameEn: found.nameEn,
          muscleGroup: found.muscleGroup,
          equipment: found.equipment,
          youtubeId: found.youtubeId,
          demoUrl: found.demoUrl,
          cues: found.cues,
        };
      }
    }
  }
  // Library exercises that no base template uses (added by personalization, e.g. Hip Thrust for a glutes emphasis).
  const extra = EXTRA_EXERCISES[name];
  if (extra) {
    return {
      name,
      nameEn: EXERCISE_NAMES_EN[name],
      muscleGroup: extra.muscleGroup,
      equipment: extra.equipment,
      youtubeId: EXERCISE_MEDIA[name]?.youtubeId,
      cues: EXERCISE_MEDIA[name]?.cues,
    };
  }
  // Exercises that only appear as swap alternatives are still valid to add to a plan.
  for (const list of Object.values(EXERCISE_ALTERNATIVES)) {
    const alt = list.find((a) => a.name === name);
    if (alt) {
      return {
        name: alt.name,
        nameEn: alt.nameEn,
        muscleGroup: alt.muscleGroup,
        equipment: alt.equipment,
        youtubeId: EXERCISE_MEDIA[name]?.youtubeId,
        cues: EXERCISE_MEDIA[name]?.cues,
      };
    }
  }
  // Home-program exercises (bodyweight and dumbbell variations): they carry their own cues and no verified video.
  return findHomeExercise(name);
}

const FALLBACK_ALTERNATIVE_COUNT = 3;

/**
 * Swap-in alternatives for an exercise. Returns the specific list defined for the name when there is one; otherwise,
 * when `muscleGroup` is given, falls back to up to three other exercises from the library that train the same muscle
 * (template exercises first, then bank-only ones), never including the exercise itself. Without a muscle group and
 * without a specific list the result is undefined (the legacy "backfill" behaviour).
 */
export function getExerciseAlternatives(name: string, muscleGroup?: MuscleGroup): ExerciseAlternative[] | undefined {
  const specific = EXERCISE_ALTERNATIVES[name];
  if (specific?.length) return specific;
  if (!muscleGroup) return undefined;

  const picked = new Map<string, ExerciseAlternative>();
  const consider = (candidate: ExerciseAlternative) => {
    if (candidate.name !== name && candidate.muscleGroup === muscleGroup && !picked.has(candidate.name)) {
      picked.set(candidate.name, candidate);
    }
  };
  for (const plan of WORKOUT_TEMPLATES) {
    for (const d of plan.days) {
      for (const e of d.exercises) {
        consider({
          id: `alt-fallback-${e.name.replace(/\s+/g, '-')}`,
          name: e.name,
          nameEn: e.nameEn ?? e.name,
          muscleGroup: e.muscleGroup,
          equipment: e.equipment,
          difficulty: 'intermediate',
          reason: 'תרגיל נוסף שמאמן את אותה קבוצת שריר',
        });
      }
    }
  }
  for (const list of Object.values(EXERCISE_ALTERNATIVES)) list.forEach(consider);
  return [...picked.values()].slice(0, FALLBACK_ALTERNATIVE_COUNT);
}

/**
 * A gentle weekly-frequency suggestion for a program - phrased as a recommendation, never a rule: the user can place
 * the sessions on any weekdays from the calendar.
 */
export function getFrequencyRecommendation(plan: Pick<WorkoutPlan, 'daysPerWeek'>): string {
  const n = plan.daysPerWeek;
  if (n <= 3) return `תדירות מומלצת: ${n} אימונים בשבוע עם יום מנוחה בין אימון לאימון 💡`;
  if (n === 4) return 'תדירות מומלצת: 4 אימונים בשבוע, עם לפחות יום מנוחה אחד באמצע השבוע 💡';
  return `תדירות מומלצת: ${n} אימונים בשבוע, עם לפחות יום מנוחה אחד ולא יותר משלושה אימונים רצופים 💡`;
}

// ---------------------------------------------------------------------------
// Exercise library (for building a plan by hand)
// ---------------------------------------------------------------------------

export interface LibraryExercise {
  name: string;
  nameEn?: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
}

let libraryCache: LibraryExercise[] | null = null;

/** Every exercise the app knows (template exercises, swap alternatives, extras), one entry per name. */
export function getExerciseLibrary(): LibraryExercise[] {
  if (libraryCache) return libraryCache;
  const byName = new Map<string, LibraryExercise>();
  const add = (e: LibraryExercise) => {
    if (!byName.has(e.name)) byName.set(e.name, e);
  };
  for (const plan of WORKOUT_TEMPLATES) {
    for (const d of plan.days) for (const e of d.exercises) add({ name: e.name, nameEn: e.nameEn, muscleGroup: e.muscleGroup, equipment: e.equipment });
  }
  for (const list of Object.values(EXERCISE_ALTERNATIVES)) {
    for (const a of list) add({ name: a.name, nameEn: a.nameEn, muscleGroup: a.muscleGroup, equipment: a.equipment });
  }
  for (const [name, info] of Object.entries(EXTRA_EXERCISES)) add({ name, nameEn: EXERCISE_NAMES_EN[name], ...info });
  for (const e of getHomeExerciseLibrary()) add(e);
  libraryCache = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  return libraryCache;
}

/** A plan exercise for the builder: library media (video, cues) and swap options are attached when the name is known. The id is unique forever. */
export function createPlanExercise(
  base: Pick<Exercise, 'name' | 'muscleGroup' | 'equipment'> & Partial<Pick<Exercise, 'nameEn' | 'sets' | 'repsRange' | 'restSeconds'>>,
): Exercise {
  const media = EXERCISE_MEDIA[base.name];
  const isCompound = base.equipment === 'barbell' || ['quads', 'hamstrings', 'glutes', 'back', 'chest'].includes(base.muscleGroup);
  return {
    id: `cx-${crypto.randomUUID()}`,
    name: base.name,
    nameEn: base.nameEn ?? EXERCISE_NAMES_EN[base.name],
    muscleGroup: base.muscleGroup,
    equipment: base.equipment,
    sets: base.sets ?? 3,
    repsRange: base.repsRange ?? (isCompound ? '8-12' : '10-15'),
    restSeconds: base.restSeconds ?? (isCompound ? 90 : 60),
    youtubeId: media?.youtubeId,
    cues: media?.cues,
    alternatives: getExerciseAlternatives(base.name, base.muscleGroup),
  };
}
