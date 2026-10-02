/**
 * System notifications for the rest timer, so a finished rest can reach the user while the app is in
 * the background. Limits worth knowing: browsers only run page timers while the page is alive, so on
 * a locked iPhone the notification can only go out once the app wakes (true lock-screen delivery
 * needs server-sent Web Push); iOS also only supports notifications for a PWA added to the Home Screen.
 */

const ASKED_KEY = 'macrolift-notification-asked';
const NOTIFICATION_ICON = '/icons/icon-192.png';
const NOTIFICATION_TAG = 'rest-timer-finished';
const NOTIFICATION_BODY = 'זמן המנוחה הסתיים! צא לסט הבא 💪';

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function wasAskedBefore(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Asks for notification permission the first time a timer is started. Must be called from the click
 * handler that starts the timer (iOS and Safari require a user gesture). It asks only once - a dismissed
 * prompt leaves permission at "default", and re-asking on every set would be a nag.
 */
export function requestNotificationPermissionOnce(): void {
  try {
    if (!isSupported() || Notification.permission !== 'default' || wasAskedBefore()) return;
    try {
      localStorage.setItem(ASKED_KEY, '1');
    } catch {
      // Storage blocked: we may ask again next time, which is acceptable.
    }
    void Promise.resolve(Notification.requestPermission()).catch(() => undefined);
  } catch {
    // Notifications unavailable in this browser.
  }
}

/** Sends the "rest is over" system notification when permission was granted. Prefers the service worker (required on Android Chrome). */
export async function notifyRestTimerFinished(): Promise<void> {
  try {
    if (!isSupported() || Notification.permission !== 'granted') return;
    const options: NotificationOptions = {
      body: NOTIFICATION_BODY,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: NOTIFICATION_TAG,
      lang: 'he',
      dir: 'rtl',
    };
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) {
      await registration.showNotification('MacroLift', options);
    } else {
      new Notification('MacroLift', options);
    }
  } catch {
    // A failed notification must never affect the timer.
  }
}
