/** Fixed id of the on-device guest profile - there is one guest profile per device, reused on every "continue as guest". */
export const GUEST_USER_ID = 'guest_user';

const GUEST_FLAG_KEY = 'macrolift_is_guest';

/** True while the active session is the guest profile, so a refresh (or a lost session pointer) can always bring the guest back. */
export function isGuestFlagSet(): boolean {
  try {
    return localStorage.getItem(GUEST_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Keeps the guest flag in step with the active session: set for the guest profile, cleared for anyone else (or no one). */
export function syncGuestFlag(activeUserId: string | null): void {
  try {
    if (activeUserId === GUEST_USER_ID) localStorage.setItem(GUEST_FLAG_KEY, 'true');
    else localStorage.removeItem(GUEST_FLAG_KEY);
  } catch {
    // Storage blocked: the session pointer alone has to carry it.
  }
}
