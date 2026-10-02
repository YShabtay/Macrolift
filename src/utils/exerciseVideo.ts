import type { Exercise } from '../types/fitness';
import { getExerciseNameEn } from '../data/workoutTemplates';

const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/;

export function isValidYouTubeId(id: string | undefined | null): id is string {
  return typeof id === 'string' && YOUTUBE_ID_PATTERN.test(id);
}

/**
 * Extracts the video id from whatever the user pastes: a watch / youtu.be / shorts / embed / live / mobile link,
 * or a bare 11-character id. Returns null when it isn't a YouTube video.
 */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (isValidYouTubeId(text)) return text;

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');

  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1];
    return isValidYouTubeId(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const fromQuery = url.searchParams.get('v');
    if (isValidYouTubeId(fromQuery)) return fromQuery;
    const [, kind, id] = url.pathname.split('/');
    if (['shorts', 'embed', 'live', 'v'].includes(kind) && isValidYouTubeId(id)) return id;
  }
  return null;
}

/** The exercise's English name, from the record itself or - for plans saved before the field existed - the template library. */
export function resolveExerciseNameEn(exercise: Pick<Exercise, 'name' | 'nameEn'>): string {
  return exercise.nameEn ?? getExerciseNameEn(exercise.name) ?? exercise.name;
}

/** A YouTube search for the exercise's form tutorial - the fallback when there is no embeddable video. */
export function buildYouTubeSearchUrl(nameEn: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nameEn} exercise form tutorial`)}`;
}

export function isVideoFile(url: string): boolean {
  return /\.(webm|mp4|m4v|mov)(\?|#|$)/i.test(url);
}
