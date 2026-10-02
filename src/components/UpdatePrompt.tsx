import { createPortal } from 'react-dom';
import { RotateCw, Sparkles } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Surfaces a new app version as an explicit choice instead of the service worker silently
 * reloading the page (registerType: 'prompt' in vite.config.ts) - a reload that happens while
 * a user is mid-set or mid-form would feel like data loss even though localStorage itself is
 * untouched by the update. The update only actually applies once the user taps "רענון עכשיו".
 */
export default function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return createPortal(
    <div className="fixed inset-x-4 top-4 z-[70] flex justify-center animate-slide-up sm:inset-x-auto sm:end-6">
      <div className="glass-card neon-border flex w-full max-w-sm flex-col gap-3 p-4 shadow-glow sm:w-96">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-400/10 text-lime-700 dark:text-lime-400">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">גרסה חדשה זמינה</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-500">הנתונים שלך שמורים ולא יימחקו</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="btn-primary flex-1 py-2 text-xs"
          >
            <RotateCw className="h-3.5 w-3.5" />
            רענון עכשיו
          </button>
          <button type="button" onClick={() => setNeedRefresh(false)} className="btn-secondary py-2 text-xs">
            לא עכשיו
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
