import type { TrainingDaysPerWeek, UserMetrics, WorkoutPlan, WorkoutSplitType } from '../types/fitness';
import { getWorkoutTemplate, suggestSplitType } from '../data/workoutTemplates';
import { getHomeWorkoutTemplate } from '../data/homeWorkoutTemplates';
import { adaptWorkoutPlan, getExperienceLevel } from './workoutAdaptation';

/** True when the profile trains at home; older profiles have no location and count as gym trainees. */
export function trainsAtHome(metrics: Pick<UserMetrics, 'trainingLocation'>): boolean {
  return metrics.trainingLocation === 'home';
}

/**
 * The workout program for a profile: the home program for its equipment and level when it trains at home, otherwise the gym
 * template for the split and weekly frequency, personalized from the profile (experience, injuries, muscle emphasis).
 * Home programs do not take the gym personalization (it adds barbell and machine lifts), so a muscle emphasis is only noted.
 */
export function buildWorkoutProgram(
  metrics: UserMetrics,
  splitType: WorkoutSplitType = suggestSplitType(metrics.trainingDaysPerWeek),
  daysPerWeek: TrainingDaysPerWeek = metrics.trainingDaysPerWeek,
): WorkoutPlan {
  if (trainsAtHome(metrics)) {
    const plan = getHomeWorkoutTemplate(metrics.homeEquipment ?? 'none', metrics.homeLevel ?? 'beginner', daysPerWeek);
    if (metrics.targetFocus && metrics.targetFocus !== 'balanced') {
      return { ...plan, adaptationNotes: [...(plan.adaptationNotes ?? []), 'דגש על פלג גוף עליון או תחתון עדיין לא זמין בתוכניות בית, והתוכנית נשארת מאוזנת.'] };
    }
    return plan;
  }
  return adaptWorkoutPlan(getWorkoutTemplate(splitType, daysPerWeek), metrics.experience, metrics.targetFocus, metrics.gender).plan;
}

/** True when the place, equipment or level changed, so a home or gym program built for the old setup no longer fits. */
export function trainingSetupChanged(before: UserMetrics, after: UserMetrics): boolean {
  if (trainsAtHome(before) !== trainsAtHome(after)) return true;
  if (!trainsAtHome(after)) return false;
  return (before.homeEquipment ?? 'none') !== (after.homeEquipment ?? 'none') || (before.homeLevel ?? 'beginner') !== (after.homeLevel ?? 'beginner');
}

/**
 * True when a gym profile's declared training experience changed, which reshapes the gym program (beginner swaps, advanced
 * variations). Home programs follow the home level instead, so they are not affected.
 */
export function gymExperienceChanged(before: UserMetrics, after: UserMetrics): boolean {
  if (trainsAtHome(after)) return false;
  return getExperienceLevel(before.experience) !== getExperienceLevel(after.experience);
}
