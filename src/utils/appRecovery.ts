/** Unregisters service workers and empties the Cache Storage, so the next load fetches a fresh copy of the app. */
async function dropOfflineCaches(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch {
    // Nothing to unregister / not allowed: carry on.
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Same: best effort.
  }
}

/** Reloads with a fresh app shell. Saved data (localStorage) is left alone. */
export async function refreshApp(): Promise<void> {
  await dropOfflineCaches();
  window.location.reload();
}

/** Wipes everything this app stored on the device (profile, logs, photos, session) and reloads. Irreversible. */
export async function resetLocalData(): Promise<void> {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // Storage blocked: nothing to clear.
  }
  await dropOfflineCaches();
  window.location.reload();
}
