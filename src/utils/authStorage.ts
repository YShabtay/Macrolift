import { storageService, type AuthUser } from '../services/storageService';

export type { AuthUser };

export async function loadUsers(): Promise<AuthUser[]> {
  return storageService.getUsers();
}

export async function saveUsers(users: AuthUser[]): Promise<void> {
  return storageService.saveUsers(users);
}

export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Reads the currently logged-in user's id, if any. */
export async function getSessionUserId(): Promise<string | null> {
  return storageService.getSessionUserId();
}

export async function setSessionUserId(userId: string): Promise<void> {
  return storageService.setSessionUserId(userId);
}

/** Clears the active session (logout). Registered users and their data are kept. */
export async function clearSession(): Promise<void> {
  return storageService.clearSession();
}
