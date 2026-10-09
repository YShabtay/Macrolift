/**
 * Finding out whether this device runs the newest version, and forcing the update when the usual service-worker route is stuck (an installed iPhone app
 * can keep its old version for days). Only the app's code and its caches are touched: the saved data (localStorage, IndexedDB) is never removed.
 */

/** The build id of the running version ("dev" when it was not injected, e.g. in tests). */
export function getBuildId(): string {
  return typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
}

const BUNDLE_PATTERN = /assets\/index-([A-Za-z0-9_-]+)\.js/;

/** The hash in the name of the main script (assets/index-HASH.js) in a piece of HTML, or null. It changes with every code change, so it identifies the version. */
export function parseBundleHash(html: string): string | null {
  return html.match(BUNDLE_PATTERN)?.[1] ?? null;
}

/** The main script of the version running right now. */
export function getRunningBundleHash(doc: Document = document): string | null {
  const src = [...doc.querySelectorAll('script[src]')].map((s) => s.getAttribute('src') ?? '').find((s) => BUNDLE_PATTERN.test(s));
  return src ? parseBundleHash(src) : null;
}

export type UpdateStatus = 'current' | 'available' | 'unknown';

/** Asks the server (bypassing every cache) which version is live and compares it with the running one. 'unknown' when offline or in development. */
export async function checkForAppUpdate(): Promise<UpdateStatus> {
  const running = getRunningBundleHash();
  if (!running) return 'unknown';
  try {
    const response = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return 'unknown';
    const live = parseBundleHash(await response.text());
    if (!live) return 'unknown';
    return live === running ? 'current' : 'available';
  } catch {
    return 'unknown';
  }
}

/**
 * Brings this device to the live version no matter what state its service worker is in: removes the worker and the app's caches, then reloads, so the
 * next load comes straight from the network and registers a fresh worker. The user's data is not touched.
 */
export async function forceAppUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {
    // Whatever could not be cleared, the reload below still asks the network first for the page.
  }
  window.location.reload();
}
