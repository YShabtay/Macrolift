import { createPortal } from 'react-dom';
import { Rocket, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Focus, visibility and reconnect events often fire together; one check per window is enough. */
const MIN_CHECK_GAP_MS = 10_000;

// The component can mount more than once (auth -> app, StrictMode); the update checks must be set up only once.
let isUpdateCheckScheduled = false;

/**
 * Asks the browser to re-fetch the service worker file whenever the app could have been away: it comes back to the foreground
 * (visibilitychange / focus), the connection returns (online), and every 15 minutes while it stays open. An installed iPhone app
 * can sit in memory for days, and the browser's own update check only runs on a full navigation - without these triggers a new
 * version would only be noticed after a manual pull-to-refresh. A found update surfaces through `needRefresh` below.
 */
function startBackgroundUpdateChecks(registration: ServiceWorkerRegistration) {
  let lastCheck = 0;
  const check = () => {
    const now = Date.now();
    if (now - lastCheck < MIN_CHECK_GAP_MS) return;
    lastCheck = now;
    registration.update().catch(() => {});
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  check(); // right after the app opens
}

/**
 * Surfaces a new app version as an explicit choice instead of silently reloading the page (registerType: 'prompt' in
 * vite.config.ts) - a reload in the middle of a set or a form would feel like data loss even though localStorage itself is
 * untouched by an update.
 *
 * Tapping "עדכן עכשיו" sends SKIP_WAITING to the waiting worker; the page reloads once the worker takes control (controllerchange),
 * with a short delay and a single-reload guard (utils/swReload.ts). A gentle toast above the bottom navigation, not a blocking dialog.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration || isUpdateCheckScheduled) return;
      isUpdateCheckScheduled = true;
      startBackgroundUpdateChecks(registration);
    },
  });

  if (!needRefresh) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-6">
      <div role="status" className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-2xl border border-lime-400/50 bg-zinc-900 p-1.5 pe-2 shadow-glow animate-slide-up">
        <button
          type="button"
          // Activates the waiting worker only; the page reloads from the controllerchange handler (utils/swReload.ts), with its guard and delay.
          onClick={() => void updateServiceWorker(false)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-right"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-400 text-zinc-950">
            <Rocket className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-zinc-100">🚀 גרסה חדשה של MacroLift זמינה!</span>
          <span className="shrink-0 rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-extrabold text-zinc-950">עדכן עכשיו 🔄</span>
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="הסתר עד לפעם הבאה"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
