import { describe, expect, it } from 'vitest';
import { WORKOUT_TEMPLATES, createPlanExercise, getExerciseLibrary } from './workoutTemplates';
import { getHomeWorkoutTemplate, HOME_TEMPLATE_DAYS, HOME_TEMPLATE_EQUIPMENT, HOME_TEMPLATE_LEVELS } from './homeWorkoutTemplates';
import { isValidYouTubeId } from '../utils/exerciseVideo';

/** Exercises with no good technique video found yet: they open a YouTube search instead. Anything new needs a video, or to be added here on purpose. */
const WITHOUT_VIDEO = new Set(['גשר ישבן עם רגליים רחוקות']);

function collect() {
  const withId = new Map<string, string | undefined>();
  const add = (name: string, id?: string) => withId.set(name, withId.get(name) ?? id);
  for (const p of WORKOUT_TEMPLATES) for (const d of p.days) for (const e of d.exercises) add(e.name, e.youtubeId);
  for (const equipment of HOME_TEMPLATE_EQUIPMENT)
    for (const level of HOME_TEMPLATE_LEVELS)
      for (const days of HOME_TEMPLATE_DAYS) for (const d of getHomeWorkoutTemplate(equipment, level, days).days) for (const e of d.exercises) add(e.name, e.youtubeId);
  return withId;
}

describe('exercise technique videos', () => {
  it('every video id in the built-in programs is a well-formed YouTube id', () => {
    for (const [name, id] of collect()) if (id !== undefined) expect(isValidYouTubeId(id), name).toBe(true);
  });

  it('every exercise in the built-in programs has a video, except the ones listed on purpose', () => {
    const missing = [...collect()].filter(([, id]) => id === undefined).map(([name]) => name).filter((n) => !WITHOUT_VIDEO.has(n));
    expect(missing).toEqual([]);
  });

  it('an exercise added from the plan builder\'s library gets a video too', () => {
    const missing = getExerciseLibrary()
      .map((e) => createPlanExercise(e))
      .filter((e) => !e.youtubeId && !WITHOUT_VIDEO.has(e.name))
      .map((e) => e.name);
    expect(missing).toEqual([]);
  });
});
