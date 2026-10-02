/**
 * Workout templates (FBW, Upper/Lower, PPL) built on hypertrophy research:
 *
 * - Weekly volume - Schoenfeld, Ogborn & Krieger (2017), "Dose-response relationship between weekly resistance
 *   training volume and increases in muscle mass" (J Sports Sci): more weekly sets per muscle means more growth, with
 *   10+ sets/week clearly ahead of lower volumes. Baz-Valle, Fontes-Villalba & Santos-Concejero (2022), a systematic review of
 *   set volume for hypertrophy, supports roughly 12-20 weekly sets for trained lifters. These templates therefore
 *   target 12-16 effective sets per week for the big muscles (chest, back, legs) for 1-3 year lifters.
 * - Frequency - Schoenfeld, Grgic, Ogborn & Krieger (2016) meta-analysis: training a muscle at least twice a week
 *   beats once a week when volume is matched, hence upper/lower and PPL give each muscle two exposures.
 * - Per-session cap - a practical guideline, NOT a hard meta-analytic cut-off: keep to about 6-8 hard sets per muscle in
 *   one session (returns diminish and later sets are mostly fatigue, "junk volume"). Spread the weekly volume across
 *   sessions instead of stacking it. Plan adaptation (utils/workoutAdaptation.ts) enforces the same cap.
 * - Exercise variation / regional hypertrophy - Fonseca et al. (2014), "Changes in exercises are more effective than
 *   in loading schemes to improve muscle strength" (J Strength Cond Res; strength outcomes), plus research on
 *   region-specific growth: use a heavy compound plus a complementary angle (stretched fly, vertical + horizontal pull,
 *   knee- + hip-dominant legs) rather than one lone exercise per big muscle. Variant "a"/"b" days rotate exercises.
 * - Legs - each lower session pairs a knee-dominant compound with a hip-dominant lift and a quad/calf accessory. Quads
 *   reach 14 direct sets/week in upper/lower; hamstrings get 6 direct sets (RDL + leg curl) on top of heavy indirect work from
 *   squats and hinges, so total lower-body volume is well above 12.
 * - Small muscles - overhead pressing does not train the lateral deltoid, so every shoulder session includes lateral
 *   raises (3-4 sets of 10-15); biceps and triceps get 3-4 focused sets per upper/push/pull session.
 *
 * Rep ranges: heavy compounds 6-10 (rest 90-120 s), complementary lifts 8-12, isolation 10-15 (rest 60-90 s).
 */
import type {
  DayWorkout,
  Equipment,
  Exercise,
  ExerciseAlternative,
  MuscleGroup,
  TrainingDaysPerWeek,
  WorkoutPlan,
  WorkoutSplitType,
} from '../types/fitness';

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
const EXERCISE_ALTERNATIVES: Record<string, ExerciseAlternative[]> = {
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

function day(id: string, dayLabel: string, focus: string, exercises: Exercise[]): DayWorkout {
  return { id, dayLabel, focus, exercises };
}

// ---------------------------------------------------------------------------
// Full Body Workout (FBW) — 3 days/week
// ---------------------------------------------------------------------------

/**
 * Day labels are Sunday/Tuesday/Thursday (א/ג/ה), not Sunday/Monday/Tuesday - full-body
 * sessions hit every major muscle group each time, so back-to-back days don't leave
 * enough recovery. The gap also doubles as the suggested rest-day placement.
 *
 * Each big muscle is trained all three days but with ONE focused exercise per session (3-4 sets), which lands
 * chest / back at 12 sets a week and legs above that - the hypertrophy range - without piling up junk volume.
 */
function buildFbwDays(): DayWorkout[] {
  return [
    day('fbw-a', 'יום א׳', 'גוף מלא - דגש רגליים וחזה', [
      ex('סקוואט מוט', 'quads', 'barbell', 4, '6-8', 120, 'תרגיל מרכזי, חימום הדרגתי'),
      ex('לחיצת חזה במוט שטוח', 'chest', 'barbell', 4, '6-10', 120),
      ex('חתירה בכבל ישיבה', 'back', 'cable', 4, '10-12', 90),
      ex('הרחקת כתפיים לצד', 'shoulders', 'dumbbell', 3, '12-15', 60),
      ex('כפיפת מרפק בפולי', 'biceps', 'cable', 3, '10-12', 60),
      ex('פלאנק', 'core', 'bodyweight', 3, '30-45 שניות', 45),
    ]),
    day('fbw-b', 'יום ג׳', 'גוף מלא - דגש גב ורגליים אחוריים', [
      ex('דדליפט רומני', 'hamstrings', 'barbell', 4, '8-10', 120, 'שמירה על גב ישר לאורך כל הטווח'),
      ex('מתח באחיזה רחבה (או מכונת עזר)', 'back', 'bodyweight', 4, '8-10', 120),
      ex('לחיצת חזה בשיפוע עם משקולות', 'chest', 'dumbbell', 4, '8-12', 90),
      ex('מכרעים הליכה', 'glutes', 'dumbbell', 3, '10-12 לכל רגל', 90),
      ex('פשיטת מרפק בפולי', 'triceps', 'cable', 3, '10-12', 60),
      ex('כפיפות בטן עם משקל', 'core', 'bodyweight', 3, '12-15', 45),
    ]),
    day('fbw-c', 'יום ה׳', 'גוף מלא - דגש כוח כללי', [
      ex('לחיצת רגליים במכונה', 'quads', 'machine', 4, '10-12', 90),
      ex('חתירת T או חתירת מוט', 'back', 'barbell', 4, '8-12', 90),
      ex('פרפר בכבלים', 'chest', 'cable', 4, '10-12', 75),
      ex('הרחקת כתפיים לצד', 'shoulders', 'dumbbell', 4, '12-15', 60),
      ex('כפיפת ברך שכיבה', 'hamstrings', 'machine', 3, '10-12', 60),
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

/** Knee-dominant compound, hip-dominant movement, a quad/knee accessory and calves. */
function lowerSession(id: string, label: string, focus: string, variant: SessionVariant): DayWorkout {
  const isA = variant === 'a';
  return day(id, label, focus, [
    isA
      ? ex('סקוואט מוט', 'quads', 'barbell', 4, '6-8', 150, 'תרגיל מרכזי')
      : ex('לחיצת רגליים במכונה', 'quads', 'machine', 4, '8-10', 120),
    isA ? ex('דדליפט רומני', 'hamstrings', 'barbell', 3, '8-12', 120) : ex('כפיפת ברך שכיבה', 'hamstrings', 'machine', 3, '10-12', 90),
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
// Each big muscle is trained twice a week with 6-7 sets per session -> 12-14 sets/week.

function buildUpperLowerDays(): DayWorkout[] {
  return [
    upperSession('ul-upper-a', 'יום א׳', 'פלג גוף עליון - כוח', 'a'),
    lowerSession('ul-lower-a', 'יום ב׳', 'פלג גוף תחתון - כוח', 'a'),
    upperSession('ul-upper-b', 'יום ג׳', 'פלג גוף עליון - נפח', 'b'),
    lowerSession('ul-lower-b', 'יום ד׳', 'פלג גוף תחתון - נפח', 'b'),
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
    buildPushDay('ppl5-push', 'יום א׳', 'a'),
    buildPullDay('ppl5-pull', 'יום ב׳', 'a'),
    buildLegsDay('ppl5-legs', 'יום ג׳', 'a'),
    buildUpperDay('ppl5-upper', 'יום ד׳'),
    lowerSession('ppl5-lower', 'יום ה׳', 'פלג גוף תחתון - שילוב', 'b'),
  ];
}

function buildPpl6Days(): DayWorkout[] {
  return [
    buildPushDay('ppl6-push-a', 'יום א׳', 'a'),
    buildPullDay('ppl6-pull-a', 'יום ב׳', 'a'),
    buildLegsDay('ppl6-legs-a', 'יום ג׳', 'a'),
    buildPushDay('ppl6-push-b', 'יום ד׳', 'b'),
    buildPullDay('ppl6-pull-b', 'יום ה׳', 'b'),
    buildLegsDay('ppl6-legs-b', 'יום ו׳', 'b'),
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
  return undefined;
}

/**
 * Looks up the swap-in alternatives defined for an exercise name. Used to backfill
 * `alternatives` onto exercises from a plan that was persisted before this data existed.
 */
export function getExerciseAlternatives(name: string): ExerciseAlternative[] | undefined {
  return EXERCISE_ALTERNATIVES[name];
}
