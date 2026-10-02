/**
 * Asks the browser not to evict this origin's storage under disk pressure (Storage API).
 * Matters most on iOS Safari, which is comparatively aggressive about clearing a site's
 * IndexedDB/localStorage when the device is low on space - persistent storage opts out of
 * that automatic eviction. Support varies (notably Safari's own UI for granting it), so this
 * is best-effort: it never blocks app boot and is safe to call even where the API is missing.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    const alreadyPersisted = (await navigator.storage.persisted?.()) ?? false;
    if (alreadyPersisted) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
