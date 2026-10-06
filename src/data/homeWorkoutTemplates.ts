/**
 * Home workout programs: full-body (3 days) and upper/lower (4 days), each for two equipment setups (nothing, or a pair of
 * dumbbells plus resistance bands) and three levels.
 *
 * How the levels work: bodyweight and light-dumbbell training can't be made harder by adding plates, so the level picks a
 * harder VARIATION of the same movement (incline push-up -> push-up -> feet-elevated push-up), and the lifter moves up a
 * variation once they reach the top of the rep range on every set. Beginners also do 3 sets per exercise instead of 4.
 *
 * Volume follows the gym programs (see data/workoutTemplates.ts): each big muscle (chest, back, quads, hamstrings) is trained
 * every session of the full-body plan or twice a week in the upper/lower plan, with at most 8 sets for one muscle in a session.
 * Beginners land at 9-12 weekly sets per big muscle, the other levels at 12-16. The exercise cues are standard technique
 * pointers, not study results, and the technique videos are listed in VIDEO_IDS below; an exercise without one falls back to
 * a YouTube search on the English name, the same way the gym exercises without a verified video do.
 *
 * Self-contained on purpose: nothing here is part of WORKOUT_TEMPLATES, so the gym library, swap lists and volume checks
 * stay exactly as they were.
 */
import type {
  DayWorkout,
  Equipment,
  Exercise,
  ExerciseAlternative,
  ExerciseDifficulty,
  HomeEquipment,
  MuscleGroup,
  TrainingDaysPerWeek,
  WorkoutPlan,
} from '../types/fitness';
import { orderExercisesByBlock } from '../utils/exerciseOrdering';

type Level = ExerciseDifficulty;

interface HomeExerciseDef {
  name: string;
  nameEn: string;
  muscle: MuscleGroup;
  equipment: Equipment;
  /** The level this variation suits: a beginner variation is the easiest form of the movement. */
  level: Level;
  reps: string;
  rest: number;
  cues: string[];
}

const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };

// ---------------------------------------------------------------------------
// Exercise catalog
// ---------------------------------------------------------------------------

const CATALOG: HomeExerciseDef[] = [
  // Chest (bodyweight)
  {
    name: 'שכיבות סמיכה בשיפוע (ידיים על ספה)',
    nameEn: 'Incline Push-Up',
    muscle: 'chest',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '8-12',
    rest: 60,
    cues: ['ידיים על משטח יציב (ספה, שולחן) מעט רחב מהכתפיים', 'גוף ישר מהראש עד העקבים, ירידה עד שהחזה כמעט נוגע במשטח'],
  },
  {
    name: 'שכיבות סמיכה על הברכיים',
    nameEn: 'Knee Push-Up',
    muscle: 'chest',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '6-12',
    rest: 60,
    cues: ['קו ישר מהברכיים עד הראש, בטן מכווצת', 'מרפקים בזווית של כ-45 מעלות מהגוף, לא פתוחים לצדדים'],
  },
  {
    name: 'שכיבות סמיכה',
    nameEn: 'Push-Up',
    muscle: 'chest',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '8-15',
    rest: 75,
    cues: ['גוף ישר כמו קרש, ישבן לא מורם ולא שקוע', 'ירידה מבוקרת עד חזה קרוב לרצפה, דחיפה מלאה למעלה'],
  },
  {
    name: 'שכיבות סמיכה בקצב איטי',
    nameEn: 'Tempo Push-Up',
    muscle: 'chest',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '6-10',
    rest: 75,
    cues: ['שלוש שניות ירידה, עצירה קצרה למטה ודחיפה חזקה', 'הקצב האיטי מעלה את הקושי בלי להוסיף משקל'],
  },
  {
    name: 'שכיבות סמיכה עם רגליים מורמות',
    nameEn: 'Decline Push-Up',
    muscle: 'chest',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '8-12',
    rest: 75,
    cues: ['כפות הרגליים על ספה או כיסא, גוף ישר', 'ככל שהרגליים גבוהות יותר, יותר עומס על החזה העליון והכתפיים'],
  },
  {
    name: 'שכיבות סמיכה בסגנון ארצ׳ר',
    nameEn: 'Archer Push-Up',
    muscle: 'chest',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '5-8 לכל צד',
    rest: 90,
    cues: ['ידיים רחבות, יורדים לצד אחד כשהיד השנייה נשארת ישרה', 'משקל הגוף עובר לצד אחד, מתקדמים לאט'],
  },
  // Chest (dumbbells)
  {
    name: 'לחיצת חזה עם משקולות על הרצפה',
    nameEn: 'Dumbbell Floor Press',
    muscle: 'chest',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '8-12',
    rest: 90,
    cues: ['שכיבה על הרצפה, המרפקים נעצרים כשהם נוגעים ברצפה', 'לחיצה למעלה עד יישור מרפקים, שכמות צמודות לרצפה'],
  },
  {
    name: 'פרפר עם משקולות על הרצפה',
    nameEn: 'Dumbbell Floor Fly',
    muscle: 'chest',
    equipment: 'dumbbell',
    level: 'intermediate',
    reps: '10-15',
    rest: 75,
    cues: ['מרפקים כפופים מעט וקבועים לאורך כל התנועה', 'פותחים עד שהמרפקים נוגעים ברצפה וסוגרים בקשת כמו חיבוק'],
  },
  {
    name: 'לחיצת חזה יחידנית על הרצפה',
    nameEn: 'Single-Arm Dumbbell Floor Press',
    muscle: 'chest',
    equipment: 'dumbbell',
    level: 'advanced',
    reps: '8-12 לכל צד',
    rest: 90,
    cues: ['משקולת אחת בלבד, הבטן מכווצת כדי שהגוף לא יסתובב', 'שליטה מלאה בירידה, עצירה קצרה על הרצפה'],
  },
  // Shoulders
  {
    name: 'לחיצת כתפיים בעמידת V (ידיים על ספה)',
    nameEn: 'Incline Pike Push-Up',
    muscle: 'shoulders',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '6-10',
    rest: 75,
    cues: ['ידיים על משטח יציב, ישבן גבוה כך שהגוף יוצר V הפוך', 'יורדים עם הראש בין הידיים ודוחפים בחזרה'],
  },
  {
    name: 'לחיצת כתפיים בעמידת V',
    nameEn: 'Pike Push-Up',
    muscle: 'shoulders',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '8-12',
    rest: 75,
    cues: ['ידיים על הרצפה, ישבן גבוה וראש יורד בין הידיים', 'מרפקים לאחור ולא לצדדים'],
  },
  {
    name: 'לחיצת כתפיים בעמידת V עם רגליים מורמות',
    nameEn: 'Elevated Pike Push-Up',
    muscle: 'shoulders',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '6-10',
    rest: 90,
    cues: ['כפות הרגליים על ספה, גוף כמעט אנכי', 'ירידה איטית עד שהראש קרוב לרצפה'],
  },
  {
    name: 'לחיצת כתפיים עם משקולות בישיבה',
    nameEn: 'Seated Dumbbell Shoulder Press',
    muscle: 'shoulders',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '8-12',
    rest: 90,
    cues: ['גב צמוד למשענת, בטן מכווצת', 'לוחצים בקשת קלה מעל הראש ויורדים עד גובה האוזניים'],
  },
  {
    name: 'לחיצת כתפיים בעמידה עם משקולות',
    nameEn: 'Standing Dumbbell Shoulder Press',
    muscle: 'shoulders',
    equipment: 'dumbbell',
    level: 'advanced',
    reps: '8-10',
    rest: 90,
    cues: ['עמידה יציבה, ישבן ובטן מכווצים ללא קשת בגב התחתון', 'לחיצה אנכית ויישור מלא מעל הראש'],
  },
  {
    name: 'הרחקת כתפיים לצד',
    nameEn: 'Dumbbell Lateral Raise',
    muscle: 'shoulders',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '12-15',
    rest: 60,
    cues: ['מרפקים כפופים מעט, מרימים עד גובה הכתפיים בלי להניף', 'משקל קל ושליטה: הכתף האמצעית עושה את העבודה, לא הצוואר'],
  },
  // Triceps
  {
    name: 'מקבילים על כיסא',
    nameEn: 'Bench Dips',
    muscle: 'triceps',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '8-12',
    rest: 60,
    cues: ['ידיים על קצה כיסא יציב, ברכיים כפופות', 'יורדים עד זווית של 90 מעלות במרפקים, כתפיים רחוקות מהאוזניים'],
  },
  {
    name: 'שכיבות סמיכה יהלום',
    nameEn: 'Diamond Push-Up',
    muscle: 'triceps',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '6-12',
    rest: 75,
    cues: ['ידיים קרובות מתחת לחזה כך שהאגודלים והאצבעות יוצרים יהלום', 'מרפקים צמודים לגוף, אפשר להתחיל על הברכיים'],
  },
  {
    name: 'מקבילים על כיסא עם רגליים ישרות',
    nameEn: 'Straight-Leg Bench Dips',
    muscle: 'triceps',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '10-15',
    rest: 60,
    cues: ['רגליים ישרות קדימה מגדילות את העומס', 'ירידה מבוקרת, בלי לתת לכתפיים לצנוח קדימה'],
  },
  {
    name: 'פשיטת מרפק מעל הראש',
    nameEn: 'Overhead Dumbbell Triceps Extension',
    muscle: 'triceps',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '10-12',
    rest: 60,
    cues: ['משקולת אחת בשתי הידיים מעל הראש, מרפקים קרובים לאוזניים', 'יורדים מאחורי הראש ומיישרים בלי להזיז את הכתפיים'],
  },
  {
    name: 'פשיטת מרפק בהטיה',
    nameEn: 'Dumbbell Triceps Kickback',
    muscle: 'triceps',
    equipment: 'dumbbell',
    level: 'intermediate',
    reps: '10-15',
    rest: 60,
    cues: ['גב ישר בהטיה, המרפק צמוד לגוף ולא זז', 'מיישרים לגמרי ועוצרים רגע בכיווץ'],
  },
  // Back
  {
    name: 'חתירה הפוכה עם ברכיים כפופות',
    nameEn: 'Bent-Knee Inverted Row',
    muscle: 'back',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '8-12',
    rest: 75,
    cues: ['רק מתחת לשולחן יציב וכבד: שולחן קל עלול להתהפך', 'גוף ישר, מושכים את החזה לקצה השולחן ומצמידים שכמות'],
  },
  {
    name: 'חתירה הפוכה מתחת לשולחן',
    nameEn: 'Inverted Row',
    muscle: 'back',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '8-12',
    rest: 75,
    cues: ['רק מתחת לשולחן יציב וכבד, רגליים ישרות', 'מושכים את החזה לשולחן, מרפקים קרוב לגוף, ירידה איטית'],
  },
  {
    name: 'חתירה הפוכה עם רגליים מורמות',
    nameEn: 'Feet-Elevated Inverted Row',
    muscle: 'back',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '6-10',
    rest: 90,
    cues: ['כפות הרגליים על כיסא או ספה, שולחן יציב וכבד', 'הגוף נשאר ישר לאורך כל החזרה'],
  },
  {
    name: 'סופרמן',
    nameEn: 'Superman',
    muscle: 'back',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '10-15',
    rest: 45,
    cues: ['שוכבים על הבטן ומרימים בו זמנית ידיים, חזה ורגליים', 'עצירה של שתי שניות למעלה, צוואר ניטרלי'],
  },
  {
    name: 'הרמות Y-T-W בשכיבה',
    nameEn: 'Prone Y-T-W Raise',
    muscle: 'back',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '8-12 לכל תנוחה',
    rest: 60,
    cues: ['שוכבים על הבטן, מרימים ידיים בצורת Y, T ואז W', 'כתפיים רחוקות מהאוזניים, תנועה איטית ומדויקת בלי להסתייע בגב התחתון'],
  },
  {
    name: 'חתירה בהטיה עם משקולות',
    nameEn: 'Bent-Over Dumbbell Row',
    muscle: 'back',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '8-12',
    rest: 90,
    cues: ['גב ישר בהטיה של כ-45 מעלות, ברכיים כפופות מעט', 'מושכים את המרפקים לאחור לכיוון הירכיים ומצמידים שכמות'],
  },
  {
    name: 'חתירת משקולת יחידה (על כיסא)',
    nameEn: 'One-Arm Dumbbell Row',
    muscle: 'back',
    equipment: 'dumbbell',
    level: 'intermediate',
    reps: '8-12 לכל צד',
    rest: 75,
    cues: ['יד וברך אחת על כיסא יציב, גב ישר', 'מושכים את המשקולת לכיוון הירך ולא לכתף'],
  },
  {
    name: 'חתירה בהטיה עם משקולות בעצירה',
    nameEn: 'Paused Bent-Over Dumbbell Row',
    muscle: 'back',
    equipment: 'dumbbell',
    level: 'advanced',
    reps: '8-10',
    rest: 90,
    cues: ['עצירה של שתי שניות בכיווץ המלא של הגב', 'ירידה איטית ושליטה, בלי תנופה מהגב התחתון'],
  },
  {
    name: 'משיכת גומיה אופקית',
    nameEn: 'Resistance Band Row',
    muscle: 'back',
    equipment: 'band',
    level: 'beginner',
    reps: '10-15',
    rest: 60,
    cues: ['גומיה קשורה למקום יציב בגובה החזה או סביב כפות הרגליים בישיבה', 'מושכים לכיוון הבטן ומצמידים שכמות, חזרה איטית'],
  },
  {
    name: 'משיכת גומיה מלמעלה',
    nameEn: 'Band Lat Pulldown',
    muscle: 'back',
    equipment: 'band',
    level: 'intermediate',
    reps: '10-15',
    rest: 60,
    cues: ['גומיה קשורה גבוה (למשל בראש דלת עם עוגן)', 'מושכים את המרפקים כלפי מטה לצדי הגוף, חזה מורם'],
  },
  // Biceps
  {
    name: 'כפיפת מרפק עם משקולות',
    nameEn: 'Dumbbell Biceps Curl',
    muscle: 'biceps',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '10-12',
    rest: 60,
    cues: ['מרפקים צמודים לגוף ולא זזים קדימה', 'עולים בכיווץ מלא ויורדים לאט עד יישור'],
  },
  {
    name: 'כפיפת מרפק פטיש',
    nameEn: 'Hammer Curl',
    muscle: 'biceps',
    equipment: 'dumbbell',
    level: 'intermediate',
    reps: '10-12',
    rest: 60,
    cues: ['אחיזה ניטרלית, כפות הידיים פונות זו לזו', 'בלי תנופה מהגוף, המרפק קבוע'],
  },
  {
    name: 'כפיפת מרפק בישיבה בריכוז',
    nameEn: 'Concentration Curl',
    muscle: 'biceps',
    equipment: 'dumbbell',
    level: 'advanced',
    reps: '10-12 לכל יד',
    rest: 60,
    cues: ['יושבים וצמידים את המרפק לירך הפנימית', 'כיפוף איטי, עצירה בכיווץ, ירידה בשליטה'],
  },
  // Quads
  {
    name: 'סקוואט משקל גוף',
    nameEn: 'Bodyweight Squat',
    muscle: 'quads',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '12-20',
    rest: 60,
    cues: ['רגליים ברוחב הכתפיים, חזה מורם וגב ישר', 'ברכיים בקו עם קצות הבהונות, יורדים לפחות עד מקביל'],
  },
  {
    name: 'ישיבה על הקיר',
    nameEn: 'Wall Sit',
    muscle: 'quads',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '30-45 שניות',
    rest: 60,
    cues: ['גב צמוד לקיר, ירכיים במקביל לרצפה וברכיים מעל הקרסוליים', 'נושמים רגיל, ידיים לא נשענות על הברכיים'],
  },
  {
    name: 'סקוואט בקצב איטי',
    nameEn: 'Tempo Squat',
    muscle: 'quads',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '10-15',
    rest: 75,
    cues: ['שלוש שניות ירידה, עצירה קצרה למטה ועלייה מהירה', 'משקל על כל כף הרגל, עקבים לא נפרדים מהרצפה'],
  },
  {
    name: 'מכרעים אחוריים',
    nameEn: 'Reverse Lunge',
    muscle: 'quads',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '10-12 לכל רגל',
    rest: 75,
    cues: ['צעד גדול לאחור, שתי הברכיים יורדות לכ-90 מעלות', 'גב זקוף, עולים בדחיפה מהרגל הקדמית'],
  },
  {
    name: 'מכרעים בולגריים (רגל על ספה)',
    nameEn: 'Bulgarian Split Squat',
    muscle: 'quads',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '8-12 לכל רגל',
    rest: 90,
    cues: ['רגל אחורית על ספה או כיסא, רוב המשקל על הרגל הקדמית', 'ירידה ישרה למטה, ברך קדמית בקו עם הבהונות'],
  },
  {
    name: 'סקוואט פיסטול עם סיוע',
    nameEn: 'Assisted Pistol Squat',
    muscle: 'quads',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '5-8 לכל רגל',
    rest: 90,
    cues: ['אוחזים בדלת או במשענת יציבה לסיוע', 'ירידה איטית על רגל אחת, הרגל השנייה ישרה קדימה'],
  },
  {
    name: 'סקוואט קפיצה',
    nameEn: 'Jump Squat',
    muscle: 'quads',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '8-12',
    rest: 75,
    cues: ['יורדים לסקוואט וקופצים בפיצוץ, נחיתה רכה על כל כף הרגל', 'מדלגים על התרגיל אם יש כאב בברכיים'],
  },
  {
    name: 'סקוואט גביע',
    nameEn: 'Goblet Squat',
    muscle: 'quads',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '10-15',
    rest: 90,
    cues: ['משקולת מוחזקת בשתי ידיים מול החזה, מרפקים בין הברכיים', 'גב ישר, יורדים עמוק ככל שהטכניקה נשמרת'],
  },
  {
    name: 'מכרעים אחוריים עם משקולות',
    nameEn: 'Dumbbell Reverse Lunge',
    muscle: 'quads',
    equipment: 'dumbbell',
    level: 'intermediate',
    reps: '10-12 לכל רגל',
    rest: 90,
    cues: ['משקולת בכל יד לצד הגוף, צעד גדול לאחור', 'גב זקוף, הברך האחורית כמעט נוגעת ברצפה'],
  },
  {
    name: 'מכרעים בולגריים',
    nameEn: 'Dumbbell Bulgarian Split Squat',
    muscle: 'quads',
    equipment: 'dumbbell',
    level: 'advanced',
    reps: '8-12 לכל רגל',
    rest: 90,
    cues: ['רגל אחורית על ספה, משקולת בכל יד', 'ירידה ישרה, הרגל הקדמית עושה את רוב העבודה'],
  },
  // Hamstrings
  {
    name: 'בוקר טוב משקל גוף',
    nameEn: 'Bodyweight Good Morning',
    muscle: 'hamstrings',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '12-15',
    rest: 60,
    cues: ['ידיים מאחורי הראש, ברכיים כפופות מעט', 'דוחפים את הישבן אחורה עם גב ישר עד מתיחה בגב הירך, וחוזרים'],
  },
  {
    name: 'גשר ישבן עם רגליים רחוקות',
    nameEn: 'Long-Foot Glute Bridge',
    muscle: 'hamstrings',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '12-15',
    rest: 60,
    cues: ['כפות הרגליים רחוקות מהישבן: זה מעביר את העומס לגב הירך', 'מרימים את האגן עד קו ישר מהכתפיים לברכיים ועוצרים רגע'],
  },
  {
    name: 'גשר ישבן על רגל אחת',
    nameEn: 'Single-Leg Glute Bridge',
    muscle: 'hamstrings',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '8-12 לכל רגל',
    rest: 60,
    cues: ['רגל אחת באוויר, האגן נשאר ישר ולא מסתובב', 'דוחפים דרך העקב ועוצרים בכיווץ'],
  },
  {
    name: 'דדליפט רומני על רגל אחת',
    nameEn: 'Single-Leg Romanian Deadlift',
    muscle: 'hamstrings',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '8-12 לכל רגל',
    rest: 75,
    cues: ['נוטים קדימה על רגל אחת כשהרגל השנייה נשלחת לאחור', 'אפשר להיאחז בקיר לאיזון, גב ישר ואגן אופקי'],
  },
  {
    name: 'כפיפת ברך בהחלקה על מגבת',
    nameEn: 'Towel Slider Hamstring Curl',
    muscle: 'hamstrings',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '6-12',
    rest: 75,
    cues: ['שוכבים על רצפה חלקה עם מגבת מתחת לעקבים, אגן מורם', 'מחליקים את העקבים החוצה לאט ומושכים בחזרה בכוח גב הירך'],
  },
  {
    name: 'דדליפט רומני עם משקולות',
    nameEn: 'Dumbbell Romanian Deadlift',
    muscle: 'hamstrings',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '10-12',
    rest: 90,
    cues: ['משקולות קרובות לרגליים, גב ישר לאורך כל התנועה', 'מורידים עד מתיחה בגב הירך ומזיזים את הירכיים קדימה בעלייה'],
  },
  {
    name: 'בוקר טוב עם משקולת',
    nameEn: 'Dumbbell Good Morning',
    muscle: 'hamstrings',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '10-15',
    rest: 75,
    cues: ['משקולת צמודה לחזה, ברכיים כפופות מעט', 'ישבן אחורה עם גב ישר, חזרה בדחיפת הירכיים קדימה'],
  },
  {
    name: 'דדליפט רומני על רגל אחת עם משקולת',
    nameEn: 'Single-Leg Dumbbell Romanian Deadlift',
    muscle: 'hamstrings',
    equipment: 'dumbbell',
    level: 'advanced',
    reps: '8-10 לכל רגל',
    rest: 90,
    cues: ['משקולת ביד הנגדית לרגל העומדת', 'אגן אופקי וגב ישר, יורדים לאט ועולים בכיווץ הישבן'],
  },
  // Glutes (used as a swap-in and for the glutes emphasis)
  {
    name: 'גשר ישבן',
    nameEn: 'Glute Bridge',
    muscle: 'glutes',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '12-20',
    rest: 45,
    cues: ['רגליים קרובות לישבן, דוחפים דרך העקבים', 'מכווצים את הישבן בראש התנועה ועוצרים'],
  },
  // Calves
  {
    name: 'הרמת עקבים בעמידה',
    nameEn: 'Standing Calf Raise',
    muscle: 'calves',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '15-20',
    rest: 45,
    cues: ['עולים לגובה מלא על קצות האצבעות ועוצרים רגע', 'ירידה איטית עד מתיחה, אפשר על קצה מדרגה'],
  },
  {
    name: 'הרמת עקבים על רגל אחת',
    nameEn: 'Single-Leg Calf Raise',
    muscle: 'calves',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '12-15 לכל רגל',
    rest: 45,
    cues: ['רגל אחת על קצה מדרגה, יד נשענת לאיזון', 'טווח מלא: ירידה עמוקה ועלייה מלאה'],
  },
  {
    name: 'הרמת עקבים עם משקולות',
    nameEn: 'Dumbbell Calf Raise',
    muscle: 'calves',
    equipment: 'dumbbell',
    level: 'beginner',
    reps: '12-20',
    rest: 45,
    cues: ['משקולת בכל יד, עולים לגובה מלא ועוצרים', 'ירידה איטית עד מתיחה מלאה'],
  },
  // Core
  {
    name: 'באג מת',
    nameEn: 'Dead Bug',
    muscle: 'core',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '8-12 לכל צד',
    rest: 45,
    cues: ['הגב התחתון צמוד לרצפה לאורך כל התנועה', 'מושיטים יד ורגל נגדיות לאט ומחליפים'],
  },
  {
    name: 'כפיפות בטן',
    nameEn: 'Crunch',
    muscle: 'core',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '12-20',
    rest: 45,
    cues: ['ידיים ליד האוזניים בלי למשוך את הצוואר', 'מרימים את הכתפיים ברכות, הגב התחתון נשאר על הרצפה'],
  },
  {
    name: 'פלאנק',
    nameEn: 'Plank',
    muscle: 'core',
    equipment: 'bodyweight',
    level: 'beginner',
    reps: '30-45 שניות',
    rest: 45,
    cues: ['מרפקים מתחת לכתפיים, גוף ישר מהראש עד העקבים', 'בטן וישבן מכווצים, בלי להשתטח בגב התחתון'],
  },
  {
    name: 'פלאנק צידי',
    nameEn: 'Side Plank',
    muscle: 'core',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '25-40 שניות לכל צד',
    rest: 45,
    cues: ['מרפק מתחת לכתף, האגן מורם בקו ישר', 'אפשר להתחיל עם ברכיים כפופות'],
  },
  {
    name: 'הרמת רגליים בשכיבה',
    nameEn: 'Lying Leg Raise',
    muscle: 'core',
    equipment: 'bodyweight',
    level: 'intermediate',
    reps: '10-15',
    rest: 45,
    cues: ['הגב התחתון צמוד לרצפה, ידיים מתחת לישבן אם צריך', 'מורידים לאט בלי שהרגליים נוגעות ברצפה'],
  },
  {
    name: 'פלאנק עם הרמת יד',
    nameEn: 'Plank Shoulder Tap',
    muscle: 'core',
    equipment: 'bodyweight',
    level: 'advanced',
    reps: '12-20 נגיעות',
    rest: 45,
    cues: ['בעמידת שכיבת סמיכה נוגעים בכתף ממול, האגן לא מתנדנד', 'רגליים ברוחב הכתפיים לאיזון'],
  },
];

/**
 * YouTube technique videos picked from search results (reputable coaches, physical therapists and fitness channels; each id was
 * checked to exist and allow embedding, but not watched). Only exercises whose video shows that movement are listed: a tempo
 * push-up shares the push-up video, while variations with no matching video (feet-elevated pike, single-leg calf raise, ...)
 * are left out on purpose and fall back to a YouTube search on their English name.
 */
const VIDEO_IDS: Record<string, string> = {
  'שכיבות סמיכה בשיפוע (ידיים על ספה)': 'cfns5VDVVvk',
  'שכיבות סמיכה על הברכיים': 'lFR1GWy1Dcs',
  'שכיבות סמיכה': 'IODxDxX7oi4',
  'שכיבות סמיכה בקצב איטי': 'IODxDxX7oi4',
  'שכיבות סמיכה עם רגליים מורמות': '5QFjmotLfW4',
  'שכיבות סמיכה בסגנון ארצ׳ר': 'MxVbNel13Ek',
  'לחיצת חזה עם משקולות על הרצפה': 'uUGDRwge4F8',
  'פרפר עם משקולות על הרצפה': 'bgC53-J-6gA',
  'לחיצת כתפיים בעמידת V': 'eG20L9cl81w',
  'לחיצת כתפיים עם משקולות בישיבה': 'rO_iEImwHyo',
  'לחיצת כתפיים בעמידה עם משקולות': 'e_f5oodNEcI',
  'הרחקת כתפיים לצד': 'Kl3LEzQ5Zqs',
  'מקבילים על כיסא': '0326dy_-CzM',
  'שכיבות סמיכה יהלום': 'kGhDnFwMY3E',
  'פשיטת מרפק מעל הראש': 'b5le--KkyH0',
  'פשיטת מרפק בהטיה': '6SS6K3lAwZ8',
  'חתירה הפוכה עם ברכיים כפופות': '5W8F6MzZ8Rk',
  'חתירה הפוכה מתחת לשולחן': 'EIFEKZe4Wm8',
  'סופרמן': 'J9zXkxUAfUA',
  'הרמות Y-T-W בשכיבה': 'QdGTI4Lshg4',
  'חתירה בהטיה עם משקולות': '6gvmcqr226U',
  'חתירת משקולת יחידה (על כיסא)': 'dFzUjzfih7k',
  'משיכת גומיה אופקית': 'LSkyinhmA8k',
  'משיכת גומיה מלמעלה': '8oRWrUxU-6I',
  'כפיפת מרפק עם משקולות': 'XE_pHwbst04',
  'כפיפת מרפק פטיש': 'lmIo_gVE8T4',
  'כפיפת מרפק בישיבה בריכוז': 'Jvj2wV0vOYU',
  'סקוואט משקל גוף': 'P-yaD24bUE8',
  'ישיבה על הקיר': 'y-wV4Venusw',
  'סקוואט בקצב איטי': 'P-yaD24bUE8',
  'מכרעים אחוריים': 'Ry-wqegeKlE',
  'מכרעים בולגריים (רגל על ספה)': 'uBSoEWZu07k',
  'סקוואט פיסטול עם סיוע': 'aYZnBGYloG4',
  'סקוואט קפיצה': 'BRfxI2Es2lE',
  'סקוואט גביע': 'gCESNsDsbqk',
  'מכרעים אחוריים עם משקולות': 'sjlsISvHyZs',
  'מכרעים בולגריים': 'uBSoEWZu07k',
  'גשר ישבן על רגל אחת': 'b1zTCyGJXCQ',
  'דדליפט רומני על רגל אחת': 'gz9l8UA_KXs',
  'כפיפת ברך בהחלקה על מגבת': 'kkkTfzi2gj4',
  'דדליפט רומני עם משקולות': 'FQKfr1YDhEk',
  'בוקר טוב עם משקולת': 'vXyv3dAt5Hc',
  'דדליפט רומני על רגל אחת עם משקולת': 'lI8-igvsnVQ',
  'גשר ישבן': 'PhTDzR0TpZs',
  'הרמת עקבים בעמידה': 'k8ipHzKeAkQ',
  'באג מת': 'GbSC02oU3To',
  'כפיפות בטן': '0t4t3IpiEao',
  'פלאנק': 'pvIjsG5Svck',
  'פלאנק צידי': 'BFOyHDlY2UE',
  'הרמת רגליים בשכיבה': 'xJJu-WiROM8',
  'פלאנק עם הרמת יד': 'gKA5LBy7WAI',
};

const BY_NAME = new Map(CATALOG.map((d) => [d.name, d]));

function def(name: string): HomeExerciseDef {
  const found = BY_NAME.get(name);
  if (!found) throw new Error(`Unknown home exercise: ${name}`);
  return found;
}

/** Every exercise of the home programs, e.g. for finding a swap-in's muscle group and technique cues by name. */
export function findHomeExercise(
  name: string,
): Pick<Exercise, 'name' | 'nameEn' | 'muscleGroup' | 'equipment' | 'cues' | 'youtubeId'> | undefined {
  const d = BY_NAME.get(name);
  return d ? { name: d.name, nameEn: d.nameEn, muscleGroup: d.muscle, equipment: d.equipment, cues: d.cues, youtubeId: VIDEO_IDS[d.name] } : undefined;
}

/** Every home exercise as a plain library entry, so the custom plan builder can offer them too. */
export function getHomeExerciseLibrary(): { name: string; nameEn: string; muscleGroup: MuscleGroup; equipment: Equipment }[] {
  return CATALOG.map((d) => ({ name: d.name, nameEn: d.nameEn, muscleGroup: d.muscle, equipment: d.equipment }));
}

// ---------------------------------------------------------------------------
// Swap-in alternatives: the other variations of the same muscle, easier and harder
// ---------------------------------------------------------------------------

const MAX_ALTERNATIVES = 5;

function slug(name: string): string {
  return name.replace(/[^\p{L}\p{N}]+/gu, '-');
}

function alternativesFor(exercise: HomeExerciseDef, equipment: HomeEquipment): ExerciseAlternative[] {
  const usable = (d: HomeExerciseDef) => equipment === 'dumbbells' || d.equipment === 'bodyweight';
  return CATALOG.filter((d) => d.muscle === exercise.muscle && d.name !== exercise.name && usable(d))
    // Closest in difficulty first, so the first suggestions are a sensible one-step easier or harder variation.
    .sort((a, b) => Math.abs(LEVEL_RANK[a.level] - LEVEL_RANK[exercise.level]) - Math.abs(LEVEL_RANK[b.level] - LEVEL_RANK[exercise.level]))
    .slice(0, MAX_ALTERNATIVES)
    .map((d) => {
      const rank = LEVEL_RANK[d.level] - LEVEL_RANK[exercise.level];
      return {
        id: `home-alt-${slug(d.nameEn)}`,
        name: d.name,
        nameEn: d.nameEn,
        muscleGroup: d.muscle,
        equipment: d.equipment,
        difficulty: d.level,
        reason: rank < 0 ? 'גרסה קלה יותר, אם הסטים קשים מדי' : rank > 0 ? 'גרסה קשה יותר, להתקדמות' : 'אותו שריר בתנועה אחרת',
        repsRange: d.reps,
      };
    });
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

interface Slot {
  names: Record<Level, string>;
  sets: Record<Level, number>;
}

/** One exercise slot: the variation for each level (the advanced one defaults to the intermediate one) and the sets per level. */
function slot(beginner: string, intermediate: string, advanced: string | undefined, sets: [number, number, number]): Slot {
  return {
    names: { beginner, intermediate, advanced: advanced ?? intermediate },
    sets: { beginner: sets[0], intermediate: sets[1], advanced: sets[2] },
  };
}

const MAIN: [number, number, number] = [3, 4, 4];
const SUPPORT: [number, number, number] = [3, 3, 3];

interface DayRecipe {
  id: string;
  label: string;
  focus: string;
  slots: Slot[];
}

const BODYWEIGHT_FBW: DayRecipe[] = [
  {
    id: 'a',
    label: 'אימון A',
    focus: 'גוף מלא - דגש רגליים ודחיפה',
    slots: [
      slot('סקוואט משקל גוף', 'סקוואט בקצב איטי', 'מכרעים בולגריים (רגל על ספה)', MAIN),
      slot('שכיבות סמיכה בשיפוע (ידיים על ספה)', 'שכיבות סמיכה', 'שכיבות סמיכה עם רגליים מורמות', MAIN),
      slot('חתירה הפוכה עם ברכיים כפופות', 'חתירה הפוכה מתחת לשולחן', 'חתירה הפוכה עם רגליים מורמות', MAIN),
      slot('בוקר טוב משקל גוף', 'דדליפט רומני על רגל אחת', 'כפיפת ברך בהחלקה על מגבת', MAIN),
      slot('לחיצת כתפיים בעמידת V (ידיים על ספה)', 'לחיצת כתפיים בעמידת V', 'לחיצת כתפיים בעמידת V עם רגליים מורמות', SUPPORT),
      slot('באג מת', 'פלאנק', 'פלאנק עם הרמת יד', SUPPORT),
    ],
  },
  {
    id: 'b',
    label: 'אימון B',
    focus: 'גוף מלא - דגש גב ורגליים אחוריים',
    slots: [
      slot('גשר ישבן עם רגליים רחוקות', 'גשר ישבן על רגל אחת', 'דדליפט רומני על רגל אחת', MAIN),
      slot('סופרמן', 'הרמות Y-T-W בשכיבה', 'חתירה הפוכה עם רגליים מורמות', MAIN),
      slot('שכיבות סמיכה על הברכיים', 'שכיבות סמיכה בקצב איטי', 'שכיבות סמיכה בסגנון ארצ׳ר', MAIN),
      slot('מכרעים אחוריים', 'מכרעים אחוריים', 'סקוואט פיסטול עם סיוע', MAIN),
      slot('מקבילים על כיסא', 'שכיבות סמיכה יהלום', 'מקבילים על כיסא עם רגליים ישרות', SUPPORT),
      slot('כפיפות בטן', 'הרמת רגליים בשכיבה', 'פלאנק צידי', SUPPORT),
    ],
  },
  {
    id: 'c',
    label: 'אימון C',
    focus: 'גוף מלא - דגש כוח כללי',
    slots: [
      slot('ישיבה על הקיר', 'סקוואט משקל גוף', 'סקוואט קפיצה', MAIN),
      slot('חתירה הפוכה עם ברכיים כפופות', 'חתירה הפוכה מתחת לשולחן', 'חתירה הפוכה עם רגליים מורמות', MAIN),
      slot('שכיבות סמיכה על הברכיים', 'שכיבות סמיכה', 'שכיבות סמיכה עם רגליים מורמות', MAIN),
      slot('בוקר טוב משקל גוף', 'כפיפת ברך בהחלקה על מגבת', undefined, MAIN),
      slot('לחיצת כתפיים בעמידת V (ידיים על ספה)', 'לחיצת כתפיים בעמידת V', 'לחיצת כתפיים בעמידת V עם רגליים מורמות', SUPPORT),
      slot('הרמת עקבים בעמידה', 'הרמת עקבים על רגל אחת', undefined, SUPPORT),
      slot('פלאנק', 'פלאנק צידי', 'הרמת רגליים בשכיבה', SUPPORT),
    ],
  },
];

const BODYWEIGHT_UPPER_LOWER: DayRecipe[] = [
  {
    id: 'upper-a',
    label: 'אימון A1 (פלג גוף עליון)',
    focus: 'פלג גוף עליון - כוח',
    slots: [
      slot('שכיבות סמיכה בשיפוע (ידיים על ספה)', 'שכיבות סמיכה', 'שכיבות סמיכה עם רגליים מורמות', MAIN),
      slot('שכיבות סמיכה על הברכיים', 'שכיבות סמיכה בקצב איטי', 'שכיבות סמיכה בסגנון ארצ׳ר', SUPPORT),
      slot('חתירה הפוכה עם ברכיים כפופות', 'חתירה הפוכה מתחת לשולחן', 'חתירה הפוכה עם רגליים מורמות', MAIN),
      slot('סופרמן', 'הרמות Y-T-W בשכיבה', undefined, SUPPORT),
      slot('לחיצת כתפיים בעמידת V (ידיים על ספה)', 'לחיצת כתפיים בעמידת V', 'לחיצת כתפיים בעמידת V עם רגליים מורמות', SUPPORT),
      slot('מקבילים על כיסא', 'מקבילים על כיסא', 'מקבילים על כיסא עם רגליים ישרות', SUPPORT),
    ],
  },
  {
    id: 'lower-a',
    label: 'אימון B1 (פלג גוף תחתון)',
    focus: 'פלג גוף תחתון - כוח',
    slots: [
      slot('סקוואט משקל גוף', 'סקוואט בקצב איטי', 'מכרעים בולגריים (רגל על ספה)', MAIN),
      slot('מכרעים אחוריים', 'מכרעים אחוריים', 'סקוואט קפיצה', SUPPORT),
      slot('בוקר טוב משקל גוף', 'דדליפט רומני על רגל אחת', 'כפיפת ברך בהחלקה על מגבת', MAIN),
      slot('גשר ישבן עם רגליים רחוקות', 'גשר ישבן על רגל אחת', undefined, SUPPORT),
      slot('הרמת עקבים בעמידה', 'הרמת עקבים על רגל אחת', undefined, SUPPORT),
      slot('באג מת', 'פלאנק', 'פלאנק עם הרמת יד', SUPPORT),
    ],
  },
  {
    id: 'upper-b',
    label: 'אימון A2 (פלג גוף עליון)',
    focus: 'פלג גוף עליון - נפח',
    slots: [
      slot('שכיבות סמיכה על הברכיים', 'שכיבות סמיכה בקצב איטי', 'שכיבות סמיכה בסגנון ארצ׳ר', MAIN),
      slot('שכיבות סמיכה בשיפוע (ידיים על ספה)', 'שכיבות סמיכה', 'שכיבות סמיכה עם רגליים מורמות', SUPPORT),
      slot('חתירה הפוכה עם ברכיים כפופות', 'חתירה הפוכה מתחת לשולחן', 'חתירה הפוכה עם רגליים מורמות', MAIN),
      slot('סופרמן', 'סופרמן', 'הרמות Y-T-W בשכיבה', SUPPORT),
      slot('לחיצת כתפיים בעמידת V (ידיים על ספה)', 'לחיצת כתפיים בעמידת V', 'לחיצת כתפיים בעמידת V עם רגליים מורמות', SUPPORT),
      slot('מקבילים על כיסא', 'שכיבות סמיכה יהלום', undefined, SUPPORT),
    ],
  },
  {
    id: 'lower-b',
    label: 'אימון B2 (פלג גוף תחתון)',
    focus: 'פלג גוף תחתון - נפח',
    slots: [
      slot('ישיבה על הקיר', 'מכרעים אחוריים', 'סקוואט פיסטול עם סיוע', MAIN),
      slot('סקוואט משקל גוף', 'סקוואט בקצב איטי', undefined, SUPPORT),
      slot('גשר ישבן עם רגליים רחוקות', 'גשר ישבן על רגל אחת', 'דדליפט רומני על רגל אחת', MAIN),
      slot('בוקר טוב משקל גוף', 'כפיפת ברך בהחלקה על מגבת', undefined, SUPPORT),
      slot('הרמת עקבים בעמידה', 'הרמת עקבים על רגל אחת', undefined, SUPPORT),
      slot('כפיפות בטן', 'הרמת רגליים בשכיבה', 'פלאנק צידי', SUPPORT),
    ],
  },
];

const DUMBBELL_FBW: DayRecipe[] = [
  {
    id: 'a',
    label: 'אימון A',
    focus: 'גוף מלא - דגש רגליים וחזה',
    slots: [
      slot('סקוואט גביע', 'סקוואט גביע', undefined, MAIN),
      slot('לחיצת חזה עם משקולות על הרצפה', 'לחיצת חזה עם משקולות על הרצפה', 'לחיצת חזה יחידנית על הרצפה', MAIN),
      slot('חתירה בהטיה עם משקולות', 'חתירה בהטיה עם משקולות', 'חתירה בהטיה עם משקולות בעצירה', MAIN),
      slot('דדליפט רומני עם משקולות', 'דדליפט רומני עם משקולות', 'דדליפט רומני על רגל אחת עם משקולת', MAIN),
      slot('הרחקת כתפיים לצד', 'הרחקת כתפיים לצד', undefined, SUPPORT),
      slot('כפיפת מרפק עם משקולות', 'כפיפת מרפק עם משקולות', 'כפיפת מרפק פטיש', SUPPORT),
    ],
  },
  {
    id: 'b',
    label: 'אימון B',
    focus: 'גוף מלא - דגש גב ורגליים אחוריים',
    slots: [
      slot('בוקר טוב עם משקולת', 'דדליפט רומני עם משקולות', 'דדליפט רומני על רגל אחת עם משקולת', MAIN),
      slot('משיכת גומיה מלמעלה', 'חתירת משקולת יחידה (על כיסא)', undefined, MAIN),
      slot('שכיבות סמיכה בשיפוע (ידיים על ספה)', 'פרפר עם משקולות על הרצפה', 'שכיבות סמיכה עם רגליים מורמות', MAIN),
      slot('מכרעים אחוריים עם משקולות', 'מכרעים אחוריים עם משקולות', 'מכרעים בולגריים', MAIN),
      slot('פשיטת מרפק מעל הראש', 'פשיטת מרפק מעל הראש', 'פשיטת מרפק בהטיה', SUPPORT),
      slot('כפיפות בטן', 'פלאנק', 'הרמת רגליים בשכיבה', SUPPORT),
    ],
  },
  {
    id: 'c',
    label: 'אימון C',
    focus: 'גוף מלא - דגש כוח כללי',
    slots: [
      slot('סקוואט גביע', 'מכרעים בולגריים', undefined, MAIN),
      slot('חתירה בהטיה עם משקולות', 'חתירת משקולת יחידה (על כיסא)', 'חתירה בהטיה עם משקולות בעצירה', MAIN),
      slot('לחיצת חזה עם משקולות על הרצפה', 'פרפר עם משקולות על הרצפה', 'לחיצת חזה יחידנית על הרצפה', MAIN),
      slot('דדליפט רומני עם משקולות', 'גשר ישבן על רגל אחת', 'כפיפת ברך בהחלקה על מגבת', MAIN),
      slot('לחיצת כתפיים עם משקולות בישיבה', 'לחיצת כתפיים עם משקולות בישיבה', 'לחיצת כתפיים בעמידה עם משקולות', SUPPORT),
      slot('הרמת עקבים עם משקולות', 'הרמת עקבים עם משקולות', undefined, SUPPORT),
    ],
  },
];

const DUMBBELL_UPPER_LOWER: DayRecipe[] = [
  {
    id: 'upper-a',
    label: 'אימון A1 (פלג גוף עליון)',
    focus: 'פלג גוף עליון - כוח',
    slots: [
      slot('לחיצת חזה עם משקולות על הרצפה', 'לחיצת חזה עם משקולות על הרצפה', 'לחיצת חזה יחידנית על הרצפה', MAIN),
      slot('שכיבות סמיכה בשיפוע (ידיים על ספה)', 'פרפר עם משקולות על הרצפה', 'שכיבות סמיכה עם רגליים מורמות', SUPPORT),
      slot('חתירה בהטיה עם משקולות', 'חתירה בהטיה עם משקולות', 'חתירה בהטיה עם משקולות בעצירה', MAIN),
      slot('משיכת גומיה אופקית', 'משיכת גומיה מלמעלה', 'חתירת משקולת יחידה (על כיסא)', SUPPORT),
      slot('לחיצת כתפיים עם משקולות בישיבה', 'לחיצת כתפיים עם משקולות בישיבה', 'לחיצת כתפיים בעמידה עם משקולות', SUPPORT),
      slot('כפיפת מרפק עם משקולות', 'כפיפת מרפק עם משקולות', 'כפיפת מרפק פטיש', SUPPORT),
      slot('פשיטת מרפק מעל הראש', 'פשיטת מרפק מעל הראש', undefined, SUPPORT),
    ],
  },
  {
    id: 'lower-a',
    label: 'אימון B1 (פלג גוף תחתון)',
    focus: 'פלג גוף תחתון - כוח',
    slots: [
      slot('סקוואט גביע', 'סקוואט גביע', 'מכרעים בולגריים', MAIN),
      slot('מכרעים אחוריים עם משקולות', 'מכרעים אחוריים עם משקולות', 'סקוואט גביע', SUPPORT),
      slot('דדליפט רומני עם משקולות', 'דדליפט רומני עם משקולות', 'דדליפט רומני על רגל אחת עם משקולת', MAIN),
      slot('גשר ישבן עם רגליים רחוקות', 'גשר ישבן על רגל אחת', 'כפיפת ברך בהחלקה על מגבת', SUPPORT),
      slot('הרמת עקבים עם משקולות', 'הרמת עקבים עם משקולות', undefined, SUPPORT),
      slot('באג מת', 'פלאנק', 'פלאנק עם הרמת יד', SUPPORT),
    ],
  },
  {
    id: 'upper-b',
    label: 'אימון A2 (פלג גוף עליון)',
    focus: 'פלג גוף עליון - נפח',
    slots: [
      slot('שכיבות סמיכה בשיפוע (ידיים על ספה)', 'שכיבות סמיכה', 'שכיבות סמיכה עם רגליים מורמות', MAIN),
      slot('לחיצת חזה עם משקולות על הרצפה', 'פרפר עם משקולות על הרצפה', 'לחיצת חזה יחידנית על הרצפה', SUPPORT),
      slot('חתירה בהטיה עם משקולות', 'חתירת משקולת יחידה (על כיסא)', 'חתירה בהטיה עם משקולות בעצירה', MAIN),
      slot('משיכת גומיה מלמעלה', 'משיכת גומיה אופקית', undefined, SUPPORT),
      slot('הרחקת כתפיים לצד', 'הרחקת כתפיים לצד', undefined, [3, 3, 4]),
      slot('כפיפת מרפק עם משקולות', 'כפיפת מרפק פטיש', 'כפיפת מרפק בישיבה בריכוז', SUPPORT),
      slot('פשיטת מרפק מעל הראש', 'פשיטת מרפק בהטיה', undefined, SUPPORT),
    ],
  },
  {
    id: 'lower-b',
    label: 'אימון B2 (פלג גוף תחתון)',
    focus: 'פלג גוף תחתון - נפח',
    slots: [
      slot('מכרעים אחוריים עם משקולות', 'מכרעים בולגריים', undefined, MAIN),
      slot('סקוואט גביע', 'סקוואט גביע', 'מכרעים אחוריים עם משקולות', SUPPORT),
      slot('בוקר טוב עם משקולת', 'דדליפט רומני עם משקולות', 'דדליפט רומני על רגל אחת עם משקולת', MAIN),
      slot('גשר ישבן עם רגליים רחוקות', 'כפיפת ברך בהחלקה על מגבת', 'גשר ישבן על רגל אחת', SUPPORT),
      slot('הרמת עקבים עם משקולות', 'הרמת עקבים עם משקולות', undefined, SUPPORT),
      slot('כפיפות בטן', 'הרמת רגליים בשכיבה', 'פלאנק צידי', SUPPORT),
    ],
  },
];

const LEVEL_TEXT: Record<Level, string> = {
  beginner: 'רמת מתחילים: וריאציות קלות ושלושה סטים לתרגיל',
  intermediate: 'רמת בינוניים: וריאציות מלאות וארבעה סטים לתרגילים המרכזיים',
  advanced: 'רמת מתקדמים: וריאציות קשות, חלקן על רגל או יד אחת',
};

const EQUIPMENT_TEXT: Record<HomeEquipment, string> = {
  none: 'ללא ציוד',
  dumbbells: 'משקולות וגומיות',
};

function buildDay(recipe: DayRecipe, planId: string, level: Level, equipment: HomeEquipment): DayWorkout {
  const exercises: Exercise[] = recipe.slots.map((s, index) => {
    const d = def(s.names[level]);
    return {
      id: `${planId}-${recipe.id}-${index + 1}`,
      name: d.name,
      nameEn: d.nameEn,
      muscleGroup: d.muscle,
      equipment: d.equipment,
      sets: s.sets[level],
      repsRange: d.reps,
      restSeconds: d.rest,
      cues: d.cues,
      youtubeId: VIDEO_IDS[d.name],
      alternatives: alternativesFor(d, equipment),
    };
  });
  return { id: `${planId}-${recipe.id}`, dayLabel: recipe.label, focus: recipe.focus, exercises: orderExercisesByBlock(exercises) };
}

const PROGRESSION_NOTE =
  'התקדמות: כשאתה מגיע לראש טווח החזרות בכל הסטים, עבור לוריאציה הקשה יותר (כפתור "החלף תרגיל" מציע גרסה קלה וקשה יותר).';
const TABLE_NOTE = 'חתירה הפוכה - רק מתחת לשולחן יציב וכבד (או מוט יציב). שולחן קל עלול להתהפך.';

/** The home program for this equipment, level and weekly frequency: 4+ days get the upper/lower split, fewer get full-body. */
export function getHomeWorkoutTemplate(equipment: HomeEquipment, level: Level, daysPerWeek: TrainingDaysPerWeek): WorkoutPlan {
  const isUpperLower = daysPerWeek >= 4;
  const split = isUpperLower ? 'upper_lower' : 'fbw';
  const days = isUpperLower ? 4 : 3;
  const equipmentKey = equipment === 'dumbbells' ? 'dumbbells' : 'none';
  const planId = `home-${equipmentKey}-${split === 'fbw' ? 'fbw' : 'ul'}-${days}-${level}`;
  const recipes =
    equipment === 'dumbbells'
      ? isUpperLower
        ? DUMBBELL_UPPER_LOWER
        : DUMBBELL_FBW
      : isUpperLower
        ? BODYWEIGHT_UPPER_LOWER
        : BODYWEIGHT_FBW;

  const notes = [PROGRESSION_NOTE];
  if (equipment === 'none') notes.push(TABLE_NOTE);
  if (daysPerWeek > 4) notes.push('תוכניות הבית מגיעות עד 4 אימונים בשבוע: יותר מזה לא מוסיף הרבה בלי ציוד, וההתאוששות חשובה יותר.');
  if (daysPerWeek < 3) notes.push('תוכניות הבית מתחילות מ-3 אימונים בשבוע, כדי שכל שריר יקבל מספיק גירוי.');

  return {
    id: planId,
    splitType: split,
    daysPerWeek: days,
    title: `אימון בית - ${isUpperLower ? 'עליון / תחתון' : 'גוף מלא'} (${EQUIPMENT_TEXT[equipmentKey]})`,
    description: `${LEVEL_TEXT[level]}. ${isUpperLower ? 'ארבעה אימונים בשבוע, כל שריר פעמיים.' : 'שלושה אימוני גוף מלא בשבוע.'}`,
    location: 'home',
    days: recipes.map((recipe) => buildDay(recipe, planId, level, equipmentKey)),
    adaptationNotes: notes,
  };
}

export const HOME_TEMPLATE_LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
export const HOME_TEMPLATE_EQUIPMENT: HomeEquipment[] = ['none', 'dumbbells'];
export const HOME_TEMPLATE_DAYS: TrainingDaysPerWeek[] = [3, 4];
