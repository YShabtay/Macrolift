export type InstallPlatform = 'ios' | 'android' | 'other';

/** Chrome's install-prompt event (not in the standard DOM typings). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const BANNER_DISMISSED_AT_KEY = 'macrolift-install-banner-dismissed-at';
const BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** True when the app already runs from the home screen (installed PWA) instead of inside a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || iosStandalone;
}

export function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  // iPadOS 13+ reports itself as a Mac; a touch screen gives it away.
  const isIPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || isIPadOs ? 'ios' : 'other';
}

/** On iOS only Safari can add to the home screen; Chrome / Firefox / in-app browsers announce themselves in the UA. */
export function isIosNonSafari(): boolean {
  return /CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
}

/** The install banner is for phones/tablets that haven't installed the app and weren't asked to hold off. */
export function shouldShowInstallBanner(now: number = Date.now()): boolean {
  if (isStandalone() || detectPlatform() === 'other') return false;
  try {
    const dismissedAt = Number(localStorage.getItem(BANNER_DISMISSED_AT_KEY));
    return !(Number.isFinite(dismissedAt) && dismissedAt > 0 && now - dismissedAt < BANNER_SNOOZE_MS);
  } catch {
    return true;
  }
}

/** Hides the banner for 7 days. */
export function snoozeInstallBanner(now: number = Date.now()): void {
  try {
    localStorage.setItem(BANNER_DISMISSED_AT_KEY, String(now));
  } catch {
    // Storage blocked: the banner just returns on the next launch.
  }
}

// --- Install prompt capture ------------------------------------------------------------------------------------
// Chrome fires `beforeinstallprompt` once, early, so it's captured here (imported from main.tsx) and handed to
// whichever component asks for it later.

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/** Shows the browser's native install dialog. Returns whether the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = null; // A captured prompt can only be used once.
  notify();
  try {
    await event.prompt();
    return (await event.userChoice).outcome === 'accepted';
  } catch {
    return false;
  }
}
