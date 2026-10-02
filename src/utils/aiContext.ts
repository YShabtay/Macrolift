import type { AppState } from '../types/fitness';
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

/** Builds a Hebrew system prompt summarizing the user's live profile, plan and progress, for the AI coach. */
export function buildCoachSystemPrompt(appState: AppState): string {
  const { profile, nutritionPlan, workoutPlan, weightLogs, schedule, progress, foodLog, stepLogs } = appState;
  const { metrics } = profile;
  const today = todayIso();

  const todaysEntries = getEntriesForDate(foodLog, today);
  const eatenToday = sumTotals(todaysEntries);
  const remainingToday = calculateRemaining(nutritionPlan.targetCalories, nutritionPlan.macros, eatenToday);
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
- ממוצע צעדים יומי: ${metrics.averageDailySteps}, צעדים שנצברו היום: ${stepsToday}

## יעד תזונתי יומי (מחושב אוטומטית לפי הפרופיל)
- קלוריות: ${nutritionPlan.targetCalories} (BMR: ${nutritionPlan.bmr}, TDEE: ${nutritionPlan.tdee})
- חלבון: ${nutritionPlan.macros.proteinG} גר', שומן: ${nutritionPlan.macros.fatG} גר', פחמימה: ${nutritionPlan.macros.carbsG} גר'

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

הנחיות מענה: היה תמציתי, חד ומעודד. השתמש במספרים הרלוונטיים מהנתונים למעלה כדי לבסס את התשובה, ואם מבקשים ממך הצעת ארוחה - הצע ארוחה קונקרטית וריאלית (עם מרכיבים ברי-השגה) שמשלימה בעיקר את החלבון שנותר להיום מבלי לחרוג משמעותית מהקלוריות שנותרו. תן תשובות מבוססות מדע בנושאי החלפת תרגילים, הגעה ליעדי חלבון, מנוחה והתאוששות, ושבירת מיתוסים בתזונה ואימונים. אל תמציא נתונים שלא ניתנו לך, ואל תמציא מידע רפואי - במקרה של שאלה רפואית או פציעה, המלץ בקצרה לפנות לרופא או פיזיותרפיסט.`;
}
