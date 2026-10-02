/**
 * Keeps the screen on while a rest timer runs (Screen Wake Lock API), so the phone doesn't auto-lock in
 * the middle of a 60-90 second rest. The browser drops the lock whenever the page is hidden, so while
 * a timer still wants it we re-request it as soon as the page is visible again. Unsupported browsers
 * (older iOS, Firefox) simply skip this.
 */

let sentinel: WakeLockSentinel | null = null;
let wanted = false;
let listenerAttached = false;

function onVisibilityChange() {
  if (wanted && document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void request();
}

async function request(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    sentinel = await navigator.wakeLock.request('screen');
    // The lock may have been released (or no longer wanted) while the request was in flight.
    if (!wanted) await releaseSentinel();
  } catch {
    // Denied (battery saver, page hidden, no gesture): the timer works without it.
    sentinel = null;
  }
}

async function releaseSentinel(): Promise<void> {
  const current = sentinel;
  sentinel = null;
  try {
    await current?.release();
  } catch {
    // Already released by the browser.
  }
}

/** Request the screen lock - call from the click that starts the timer. */
export function acquireScreenWakeLock(): void {
  wanted = true;
  if (!listenerAttached && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    listenerAttached = true;
  }
  if (!sentinel || sentinel.released) void request();
}

/** Let the screen sleep again (timer finished, paused or cancelled). */
export function releaseScreenWakeLock(): void {
  wanted = false;
  void releaseSentinel();
}
