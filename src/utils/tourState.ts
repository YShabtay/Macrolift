const TOUR_SEEN_KEY = 'macrolift-tour-seen';

/** Whether the first-run tour already ran on this device (it auto-starts once; later it's opened from the profile screen). */
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === '1';
  } catch {
    return true; // Can't remember the choice, so don't risk re-showing it on every launch.
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, '1');
  } catch {
    // Storage blocked: nothing to persist.
  }
}
