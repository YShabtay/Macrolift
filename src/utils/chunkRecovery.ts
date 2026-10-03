const RETRY_FLAG = 'chunk_retry';
/** How long the app must run without a chunk error before the one-retry allowance is restored. */
const STABLE_AFTER_MS = 10_000;

const CHUNK_ERROR_PATTERNS = ['Failed to fetch dynamically imported module', 'ChunkLoadError', 'Loading chunk', 'Importing a module script failed'];

/** True for the errors a stale tab gets when a deploy replaced the hashed files its page still points at. */
export function isChunkLoadError(error: unknown): boolean {
  const text =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? `${error.name} ${error.message}`
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : '';
  return CHUNK_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
}

/**
 * Silent recovery for a stale-chunk error: reloads once to pick up the new version. Returns true when a reload was started
 * (show nothing alarming meanwhile); false when a retry was already used this session - then the error is real and should be shown,
 * which is what prevents a reload loop.
 */
export function tryRecoverFromChunkError(): boolean {
  try {
    if (sessionStorage.getItem(RETRY_FLAG)) return false;
    sessionStorage.setItem(RETRY_FLAG, 'true');
  } catch {
    return false; // Can't remember the attempt, so don't risk looping.
  }
  window.location.reload();
  return true;
}

/** Clears the retry flag once the app has run cleanly for a while, so a future deploy gets its own single retry. */
function clearRetryFlagWhenStable() {
  setTimeout(() => {
    try {
      sessionStorage.removeItem(RETRY_FLAG);
    } catch {
      // Storage blocked: nothing to clear.
    }
  }, STABLE_AFTER_MS);
}

/**
 * Catches stale-chunk failures that never reach a React error boundary - dynamic imports reject asynchronously, and Vite announces
 * failed preloads with `vite:preloadError` - and recovers with the same single silent reload.
 */
export function installChunkErrorRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (tryRecoverFromChunkError()) event.preventDefault();
  });
  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error ?? event.message)) tryRecoverFromChunkError();
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) tryRecoverFromChunkError();
  });
  clearRetryFlagWhenStable();
}
