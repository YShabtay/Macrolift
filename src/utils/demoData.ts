import type {
  AppState,
  DayWorkout,
  FoodEntry,
  NutritionPlan,
  ProgressPhoto,
  SetProgressEntry,
  StepLog,
  UserMetrics,
  UserProfile,
  WeightLog,
  WorkoutScheduleEntry,
} from '../types/fitness';
import { calculateNutritionPlan } from './calculations';
import { getWorkoutTemplate } from '../data/workoutTemplates';
import { formatIsoDate, getWeekStart, parseIsoDate, todayIso } from './weightCalculations';
import { storageService } from '../services/storageService';

/** Fixed id so re-entering demo mode always re-seeds the same "account" instead of piling up new ones. */
export const DEMO_USER_ID = 'demo-guest';

// The same (AI-generated) person, same gym and pose, before and after six months of lean bulking; stored in the project so the demo needs no network.
const BEFORE_PHOTO_SOURCE_URL = '/images/demo/progress-before.jpg';
const AFTER_PHOTO_SOURCE_URL = '/images/demo/progress-after.jpg';

const BEFORE_PHOTO_DATE = '2026-03-15';
const BEFORE_PHOTO_WEIGHT_KG = 66.5;
const AFTER_PHOTO_DATE = '2026-09-20';
const AFTER_PHOTO_WEIGHT_KG = 68.8;

const MAX_IMAGE_DIMENSION = 900;
const JPEG_QUALITY = 0.8;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function daysAgoIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatIsoDate(d);
}

function addDaysIso(dateStr: string, days: number): string {
  const d = parseIsoDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatIsoDate(d);
}

/**
 * Downloads an external image and re-encodes it as a compressed JPEG data URL, the same
 * shape a real uploaded progress photo would produce (see imageEncoding.ts). This lets demo
 * photos work with every feature that expects a data URL, including the Gemini AI photo review.
 */
async function fetchImageAsDataUrl(url: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load demo image: ${url}`));
    img.src = url;
  });

  let { naturalWidth: width, naturalHeight: height } = img;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width >= height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export function buildDemoMetrics(): UserMetrics {
  return {
    gender: 'male',
    age: 29,
    heightCm: 170,
    weightKg: 68.8,
    averageDailySteps: 7800,
    trainingDaysPerWeek: 3,
    bodyState: 'athletic',
    goal: 'gain_muscle',
    goalIntensity: 'moderate',
    bulkingPlan: {
      durationMonths: 6,
      startDate: daysAgoIso(56),
      gainMode: 'per_region',
      regionGainCm: { armCm: 2, chestCm: 3, hipCm: 3 },
    },
  };
}

/** 8 weeks of weigh-ins showing a gentle, realistic lean-bulk upward trend ending at today's weight. */
function buildDemoWeightLogs(endWeight: number): WeightLog[] {
  const totalDays = 56;
  const startWeight = round1(endWeight - 1.6);
  const logs: WeightLog[] = [];

  for (let d = totalDays; d >= 3; d -= 3) {
    const progress = 1 - d / totalDays;
    const trend = startWeight + (endWeight - startWeight) * progress;
    const noise = Math.sin(d * 1.7) * 0.25;
    logs.push({ id: `demo-weight-${d}`, date: daysAgoIso(d), weightKg: round1(trend + noise) });
  }

  logs.push({ id: 'demo-weight-today', date: todayIso(), weightKg: endWeight });
  return logs;
}

/** Steps above (+) and below (-) the daily goal for each weekday, Sunday first: a week with long days and short ones, so the step chart shows both. */
const DEMO_STEP_OFFSETS = [3100, -1600, 2200, -2400, 1400, 4200, 900];

/** Two weeks of steps around the goal, ending with a good day so far today (the calorie bank has something in it). Exported for tests. */
export function buildDemoStepLogs(goalSteps: number, today: string = todayIso()): StepLog[] {
  const logs: StepLog[] = [];
  for (let d = 13; d >= 1; d--) {
    const date = addDaysIso(today, -d);
    logs.push({ date, steps: Math.max(1500, goalSteps + DEMO_STEP_OFFSETS[parseIsoDate(date).getDay()]) });
  }
  logs.push({ date: today, steps: goalSteps + 2400 });
  return logs;
}

/** Calories eaten above (+) or below (-) the day's target for each weekday, Sunday first, so the week so far is over and the rebalance screen has a table to show. */
const DEMO_CALORIE_DELTAS = [170, 40, 210, -60, 90, 130, 0];
const DEMO_MEALS: { meal: FoodEntry['meal']; share: number; name: string; time: string }[] = [
  { meal: 'breakfast', share: 0.3, name: 'ארוחת בוקר: ביצים, לחם מלא ואבוקדו', time: '07:45' },
  { meal: 'lunch', share: 0.4, name: 'ארוחת צהריים: חזה עוף, אורז וירקות', time: '13:15' },
  { meal: 'dinner', share: 0.3, name: 'ארוחת ערב: דג, תפוחי אדמה וסלט', time: '20:00' },
];

/** The days of the current week before today, each eaten a little over or under the plan's target, plus today's meals. Exported for tests. */
export function buildDemoWeekFoodLog(plan: NutritionPlan, today: string = todayIso()): FoodEntry[] {
  const log: FoodEntry[] = [];
  const weekStart = getWeekStart(today);
  for (let date = weekStart; date < today; date = addDaysIso(date, 1)) {
    const total = plan.targetCalories + DEMO_CALORIE_DELTAS[parseIsoDate(date).getDay()];
    for (const m of DEMO_MEALS) {
      log.push({
        id: `demo-food-${date}-${m.meal}`,
        date,
        meal: m.meal,
        name: m.name,
        quantity: '1 מנה',
        time: m.time,
        calories: Math.round(total * m.share),
        proteinG: Math.round(plan.macros.proteinG * m.share),
        fatG: Math.round(plan.macros.fatG * m.share),
        carbsG: Math.round(plan.macros.carbsG * m.share * (total / plan.targetCalories)),
      });
    }
  }
  return log;
}

function buildDemoTodayFood(): FoodEntry[] {
  const today = todayIso();
  return [
    {
      id: 'demo-food-breakfast',
      date: today,
      meal: 'breakfast',
      name: 'שלוש ביצים מקושקשות עם לחם מלא ואבוקדו',
      quantity: '1 מנה',
      weightGrams: 220,
      time: '07:30',
      calories: 420,
      proteinG: 28,
      fatG: 22,
      carbsG: 30,
    },
    {
      id: 'demo-food-lunch',
      date: today,
      meal: 'lunch',
      name: 'חזה עוף בגריל עם אורז מלא וברוקולי',
      quantity: '1 צלחת',
      weightGrams: 400,
      time: '13:00',
      calories: 560,
      proteinG: 52,
      fatG: 12,
      carbsG: 60,
    },
    {
      id: 'demo-food-snack',
      date: today,
      meal: 'snacks',
      name: 'יוגורט יווני עם דבש ואגוזי מלך',
      quantity: '1 יחידה',
      weightGrams: 200,
      time: '16:30',
      calories: 260,
      proteinG: 18,
      fatG: 12,
      carbsG: 22,
    },
  ];
}

/** Builds this week's schedule (Sun/Tue/Thu, matching the FBW template's day labels) and marks past/in-progress sets as completed. */
function buildDemoScheduleAndProgress(workoutDays: DayWorkout[]): {
  schedule: WorkoutScheduleEntry[];
  progress: SetProgressEntry[];
} {
  const today = todayIso();
  const weekStart = getWeekStart(today);
  const [fbwA, fbwB, fbwC] = workoutDays;

  const schedule: WorkoutScheduleEntry[] = [
    { date: weekStart, dayId: fbwA.id },
    { date: addDaysIso(weekStart, 2), dayId: fbwB.id },
    { date: addDaysIso(weekStart, 4), dayId: fbwC.id },
  ];

  const progress: SetProgressEntry[] = [];
  for (const entry of schedule) {
    const dayWorkout = workoutDays.find((d) => d.id === entry.dayId);
    if (!dayWorkout) continue;

    if (entry.date < today) {
      // Already happened this week - fully completed.
      for (const exercise of dayWorkout.exercises) {
        progress.push({ exerciseId: exercise.id, dayId: entry.dayId, date: entry.date, completedSets: exercise.sets });
      }
    } else if (entry.date === today) {
      // Today's session - partway through, for a "live" feel.
      const doneCount = Math.max(1, Math.ceil(dayWorkout.exercises.length / 2));
      dayWorkout.exercises.forEach((exercise, idx) => {
        const completedSets = idx < doneCount - 1 ? exercise.sets : idx === doneCount - 1 ? Math.ceil(exercise.sets / 2) : 0;
        if (completedSets > 0) {
          progress.push({ exerciseId: exercise.id, dayId: entry.dayId, date: entry.date, completedSets });
        }
      });
    }
  }

  return { schedule, progress };
}

/** Builds a full, realistic AppState for the "guest demo" experience - a rich account a visitor can explore instantly, with no signup. */
export async function buildDemoAppState(): Promise<AppState> {
  const metrics = buildDemoMetrics();
  const nutritionPlan = calculateNutritionPlan(metrics);
  const workoutPlan = getWorkoutTemplate('fbw', metrics.trainingDaysPerWeek);

  const profile: UserProfile = {
    id: DEMO_USER_ID,
    name: 'משתמש דמו',
    createdAt: `${daysAgoIso(56)}T08:00:00.000Z`,
    metrics,
  };

  const [beforePhotoUrl, afterPhotoUrl] = await Promise.all([
    fetchImageAsDataUrl(BEFORE_PHOTO_SOURCE_URL),
    fetchImageAsDataUrl(AFTER_PHOTO_SOURCE_URL),
  ]);

  const weightLogs = buildDemoWeightLogs(metrics.weightKg);

  const progressPhotos: ProgressPhoto[] = [
    {
      id: 'demo-photo-before',
      date: BEFORE_PHOTO_DATE,
      photoUrl: beforePhotoUrl,
      weightKg: BEFORE_PHOTO_WEIGHT_KG,
      notes: 'תחילת תוכנית מסה מבוקרת',
    },
    {
      id: 'demo-photo-after',
      date: AFTER_PHOTO_DATE,
      photoUrl: afterPhotoUrl,
      weightKg: AFTER_PHOTO_WEIGHT_KG,
      notes: 'מצב נוכחי לאחר 6 חודשים',
    },
  ];

  const { schedule, progress } = buildDemoScheduleAndProgress(workoutPlan.days);

  return {
    profile,
    nutritionPlan,
    workoutPlan,
    progress,
    weightLogs,
    progressPhotos,
    schedule,
    foodLog: [...buildDemoWeekFoodLog(nutritionPlan), ...buildDemoTodayFood()],
    stepLogs: buildDemoStepLogs(metrics.averageDailySteps),
    // The calorie bank is the interesting mode to look at: steps above the goal become calories, short days take them off.
    stepMode: 'add_calories',
    circumferenceLogs: [],
    circumferenceGoals: {},
  };
}

/** Seeds (or re-seeds) the fixed demo account and opens a session for it. Returns the demo user id to authenticate with. */
export async function startDemoSession(): Promise<string> {
  const demoState = await buildDemoAppState();
  await storageService.saveAppState(DEMO_USER_ID, demoState);
  await storageService.setSessionUserId(DEMO_USER_ID);
  return DEMO_USER_ID;
}
