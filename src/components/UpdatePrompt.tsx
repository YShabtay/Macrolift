import { createPortal } from 'react-dom';
import { RotateCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Surfaces a new app version as an explicit choice instead of the service worker silently
 * reloading the page (registerType: 'prompt' in vite.config.ts) - a reload that happens while
 * a user is mid-set or mid-form would feel like data loss even though localStorage itself is
 * untouched by the update. The update only actually applies once the user taps "עדכן ורענן עכשיו".
 *
 * Shown as a centered modal rather than a top banner: a top-anchored toast gets hidden behind the
 * camera/Dynamic Island on iPhone.
 */
export default function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
      onClick={() => setNeedRefresh(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-prompt-title"
        className="glass-card neon-border flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="update-prompt-title" className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
            גרסה חדשה זמינה! 🚀
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            שיפורים ותיקונים מחכים לך. הנתונים שלך שמורים ולא יימחקו בעדכון.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <button type="button" onClick={() => updateServiceWorker(true)} className="btn-primary w-full">
            <RotateCw className="h-4 w-4" />
            עדכן ורענן עכשיו
          </button>
          <button type="button" onClick={() => setNeedRefresh(false)} className="btn-secondary w-full">
            הזכר לי אחר כך
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
