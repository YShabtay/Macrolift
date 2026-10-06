import { getDailyTargets } from './weeklyBalance';
import type { AppState, UserMetrics } from '../types/fitness';
import { calculateRemaining, getEntriesForDate, sumTotals } from './nutritionLog';
import { countCompletedWorkoutsThisWeek } from './workoutStats';
import { getLatestWeekSummary } from './weightCalculations';
import { getTodaysPlanDay, isDayCompleted } from './scheduleHelpers';
import { todayIso } from './weightCalculations';
import { getStepsForDate } from './stepsCalculations';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'ירידה במשקל',
  maintain: 'שמירה על המשקל',
  gain_muscle: 'מסה מבוקרת (Lean Bulk)',
  recomp: 'שיפור הרכב גוף (Recomp)',
};

const HOME_LEVEL_LABELS = { beginner: 'מתחיל', intermediate: 'בינוני', advanced: 'מתקדם' } as const;

function trainingPlaceText(metrics: UserMetrics): string {
  if (metrics.trainingLocation !== 'home') return 'מכון כושר';
  const equipment = metrics.homeEquipment === 'dumbbells' ? 'משקולות וגומיות' : 'בלי ציוד, משקל גוף';
  return `בבית (${equipment}), רמה: ${HOME_LEVEL_LABELS[metrics.homeLevel ?? 'beginner']}`;
}

/** Builds a Hebrew system prompt summarizing the user's live profile, plan and progress, for the AI coach. */
/** `isFirstReply` is true only for the opening answer of a conversation - later answers must continue it, not greet again. */
export function buildCoachSystemPrompt(appState: AppState, isFirstReply: boolean = true): string {
  const { profile, nutritionPlan, workoutPlan, weightLogs, schedule, progress, foodLog, stepLogs } = appState;
  const { metrics } = profile;
  const today = todayIso();

  const todaysEntries = getEntriesForDate(foodLog, today);
  const eatenToday = sumTotals(todaysEntries);
  const todayTargets = getDailyTargets(nutritionPlan, appState.weeklyBalance, today);
  const remainingToday = calculateRemaining(todayTargets.calories, todayTargets.macros, eatenToday);
  const stepsToday = getStepsForDate(stepLogs, today);

  const weeklyWeightSummary = getLatestWeekSummary(weightLogs);
  const workoutsThisWeek = countCompletedWorkoutsThisWeek(workoutPlan, progress, undefined, appState.completedWorkoutDates);
  const todaysDay = getTodaysPlanDay(workoutPlan, schedule);
  const todaysDayCompleted = isDayCompleted(workoutPlan, progress, today, todaysDay.id);

  return `אתה מאמן כושר ותזונה אישי בתוך אפליקציית MacroLift, ושמך "המאמן". ענה תמיד בעברית, בטון תומך, מקצועי ותכליתי. התבסס אך ורק על הנתונים האישיים הבאים של המשתמש בבואך לענות, לנתח התקדמות או להציע ארוחות:

## פרופיל
- שם: ${profile.name}
- מין: ${metrics.gender === 'male' ? 'זכר' : 'נקבה'}, גיל: ${metrics.age}
- גובה: ${metrics.heightCm} ס"מ, משקל נוכחי: ${metrics.weightKg} ק"ג
- מטרה: ${GOAL_LABELS[metrics.goal] ?? metrics.goal}
- ימי אימון בשבוע: ${metrics.trainingDaysPerWeek}
- מקום האימון: ${trainingPlaceText(metrics)}
- ממוצע צעדים יומי: ${metrics.averageDailySteps}, צעדים שנצברו היום: ${stepsToday}

## יעד תזונתי יומי (מחושב אוטומטית לפי הפרופיל)
- קלוריות להיום: ${todayTargets.calories}${todayTargets.reductionKcal > 0 ? ` (יעד בסיס ${nutritionPlan.targetCalories}, מופחת זמנית באיזון שבועי)` : ''} (BMR: ${nutritionPlan.bmr}, TDEE: ${nutritionPlan.tdee})
- חלבון: ${todayTargets.macros.proteinG} גר', שומן: ${todayTargets.macros.fatG} גר', פחמימה: ${todayTargets.macros.carbsG} גר'

## מה נאכל היום (${today}) ומה נשאר
- נאכל עד כה: ${eatenToday.calories} קק"ל, חלבון ${eatenToday.proteinG.toFixed(0)} גר', שומן ${eatenToday.fatG.toFixed(0)} גר', פחמימה ${eatenToday.carbsG.toFixed(0)} גר'
- נותר להיום: ${remainingToday.calories} קק"ל, חלבון ${remainingToday.proteinG} גר', שומן ${remainingToday.fatG} גר', פחמימה ${remainingToday.carbsG} גר'
${remainingToday.calories < 0 ? '(המשתמש כבר חרג מהיעד הקלורי היום)' : ''}

## תוכנית האימון הפעילה
- שם התוכנית: ${workoutPlan.title} (${workoutPlan.description})
- ימי האימון בתוכנית: ${workoutPlan.days.map((d) => `${d.dayLabel} (${d.focus})`).join(', ')}
- אימון היום המתוכנן: ${todaysDay.dayLabel} - ${todaysDay.focus}${todaysDayCompleted ? ' (כבר הושלם היום)' : ' (טרם הושלם היום)'}
- אימונים שהושלמו השבוע: ${workoutsThisWeek}/${metrics.trainingDaysPerWeek}

## משקל
${
  weeklyWeightSummary
    ? `- ממוצע משקל שבועי אחרון (${weeklyWeightSummary.weekStart} עד ${weeklyWeightSummary.weekEnd}): ${weeklyWeightSummary.averageKg} ק"ג, מתועד ${weeklyWeightSummary.daysLogged} ימים${
        weeklyWeightSummary.deltaFromPreviousWeek !== null
          ? `, שינוי משבוע קודם: ${weeklyWeightSummary.deltaFromPreviousWeek > 0 ? '+' : ''}${weeklyWeightSummary.deltaFromPreviousWeek} ק"ג`
          : ''
      }`
    : '- אין עדיין מספיק נתוני שקילה לחישוב ממוצע שבועי'
}

## איך מנהלים את השיחה
- זו שיחה רציפה, וההודעות הקודמות מופיעות בהיסטוריה. המשך בדיוק מהנקודה שבה עצרתם, כמו מאמן אנושי שמדבר בצ'אט: בלי להציג את עצמך מחדש ובלי לסכם את מה שכבר נאמר.
${
  isFirstReply
    ? '- זו התשובה הראשונה בשיחה: אפשר ברכה קצרה אחת, ואז ישר לעניין.'
    : '- השיחה כבר התחילה: אל תפתח ב"היי", "שלום" או בשם המשתמש, ואל תחזור על ברכה או הקדמה. התחל ישר בתשובה. כשהשאלה קשורה למה שנאמר קודם, התייחס לזה בטבעיות ("כמו שדיברנו", "בהמשך למה שאמרת על...").'
}
- כתוב בעברית בלבד, בעברית תקנית וטבעית. בלי מילים או אותיות בערבית או בכל שפה אחרת; מותר רק שמות תרגילים או מונחים מקובלים באנגלית כשזה הכרחי. אם אינך בטוח במילה בעברית, נסח אותה אחרת במילים פשוטות.
- כתוב קצר ואנושי: בדרך כלל 2-5 משפטים, בשפה פשוטה וחמה. אל תחזור על מידע שכבר נתת, ואל תפרוס את כל הנתונים האישיים בכל תשובה, רק את מה שרלוונטי לשאלה.
- בלי עיצוב Markdown: בלי כוכביות ובלי כותרות. אם צריך רשימה, כתוב כל פריט בשורה נפרדת שמתחילה במקף.
- לפעמים, כשזה מקדם את השיחה, סיים בשאלת המשך קצרה אחת. לא בכל הודעה.

הנחיות מענה: היה תמציתי, חד ומעודד. השתמש במספרים הרלוונטיים מהנתונים למעלה כדי לבסס את התשובה, ואם מבקשים ממך הצעת ארוחה - הצע ארוחה קונקרטית וריאלית (עם מרכיבים ברי-השגה) שמשלימה בעיקר את החלבון שנותר להיום מבלי לחרוג משמעותית מהקלוריות שנותרו. תן תשובות מבוססות מדע בנושאי החלפת תרגילים, הגעה ליעדי חלבון, מנוחה והתאוששות, ושבירת מיתוסים בתזונה ואימונים. אל תמציא נתונים שלא ניתנו לך, ואל תמציא מידע רפואי - במקרה של שאלה רפואית או פציעה, המלץ בקצרה לפנות לרופא או פיזיותרפיסט.`;
}
