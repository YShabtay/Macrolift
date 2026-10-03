const RELOAD_DELAY_MS = 200;

/**
 * Reloads the page once a new service worker takes control, after a short pause so its cache is ready - reloading in the same
 * instant can request files the new worker hasn't finished serving ("Failed to fetch dynamically imported module").
 * A guard makes sure several controllerchange events (or several tabs) can't trigger more than one reload.
 *
 * Only reloads for an UPDATE: when the page had no controller yet, the first claim by a freshly installed worker is not a new version.
 */
export function installControllerChangeReload(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let isRefreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || isRefreshing) return;
    isRefreshing = true;
    setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
  });
}
