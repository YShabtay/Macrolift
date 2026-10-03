/**
 * Reads and parses a JSON value from localStorage. Anything that goes wrong - storage blocked (private mode),
 * a missing key, an empty or corrupted string, or a stored `null` - yields `fallback` instead of throwing.
 */
export function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null || raw.trim() === '') return fallback;
    const parsed: unknown = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}
