import { createPortal } from 'react-dom';
import { Rocket, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// The component can mount more than once (auth -> app, StrictMode); the update checks must be set up only once.
let isUpdateCheckScheduled = false;

/**
 * Surfaces a new app version as an explicit choice instead of the service worker silently reloading the page
 * (registerType: 'prompt' in vite.config.ts) - a reload in the middle of a set or a form would feel like data loss even
 * though localStorage itself is untouched by an update. The update only applies once the user taps the toast.
 *
 * A gentle toast above the bottom navigation (not a blocking dialog). The worker is also asked for updates every hour and
 * whenever the app returns to the foreground, because an installed iPhone app can stay open for days without a reload.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration || isUpdateCheckScheduled) return;
      isUpdateCheckScheduled = true;
      const check = () => {
        registration.update().catch(() => undefined);
      };
      setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  if (!needRefresh) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-6">
      <div role="status" className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-2xl border border-lime-400/50 bg-zinc-900 p-1.5 pe-2 shadow-glow animate-slide-up">
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-right"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-400 text-zinc-950">
            <Rocket className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold leading-snug text-zinc-100">גרסה חדשה של MacroLift זמינה! לחץ לרענון 🚀</span>
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
