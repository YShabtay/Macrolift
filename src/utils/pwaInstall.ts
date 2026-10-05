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
  if (typeof window === 'undefined' || !window.navigator) return false;
  try {
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || iosStandalone;
  } catch {
    return false;
  }
}

export function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  // iPadOS 13+ reports itself as a Mac; a touch screen gives it away.
  const isIPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || isIPadOs ? 'ios' : 'other';
}

/** On iOS only Safari can add to the home screen; Chrome / Firefox / in-app browsers announce themselves in the UA. */
export function isIosNonSafari(): boolean {
  return typeof navigator !== 'undefined' && /CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram/i.test(navigator.userAgent || '');
}

/**
 * The social/chat app whose built-in browser opened the page, in Hebrew, or null for a normal browser. These in-app browsers can't install a
 * web app (no "Install app" in their menu), so a link opened from an Instagram story must first be reopened in Chrome / Safari.
 */
export function getInAppBrowserName(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent || ''): string | null {
  if (/Instagram/i.test(ua)) return 'אינסטגרם';
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)) return 'פייסבוק';
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'טיקטוק';
  if (/Snapchat/i.test(ua)) return 'סנאפצ׳אט';
  if (/LinkedInApp/i.test(ua)) return 'לינקדאין';
  if (/Twitter/i.test(ua)) return 'אקס (טוויטר)';
  if (/Pinterest/i.test(ua)) return 'פינטרסט';
  if (/Line\//i.test(ua)) return 'LINE';
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return 'אפליקציה';
  return null;
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

const STANDALONE_WELCOME_SEEN_KEY = 'macrolift-has-seen-standalone-welcome';

/** Whether the first-launch welcome (restore a backup or start fresh) already showed in the installed app. */
export function hasSeenStandaloneWelcome(): boolean {
  try {
    return localStorage.getItem(STANDALONE_WELCOME_SEEN_KEY) === 'true';
  } catch {
    return true; // Can't remember the choice, so don't risk showing it on every launch.
  }
}

export function markStandaloneWelcomeSeen(): void {
  try {
    localStorage.setItem(STANDALONE_WELCOME_SEEN_KEY, 'true');
  } catch {
    // Storage blocked: nothing to persist.
  }
}

const WELCOME_GUIDE_SEEN_KEY = 'macrolift-welcome-guide-seen';

/** Whether the short new-user introduction (data lives on the device, install, backup) already ran on this device. */
export function hasSeenWelcomeGuide(): boolean {
  try {
    return localStorage.getItem(WELCOME_GUIDE_SEEN_KEY) === 'true';
  } catch {
    return true; // Can't remember the choice, so don't risk showing it on every launch.
  }
}

export function markWelcomeGuideSeen(): void {
  try {
    localStorage.setItem(WELCOME_GUIDE_SEEN_KEY, 'true');
  } catch {
    // Storage blocked: nothing to persist.
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
