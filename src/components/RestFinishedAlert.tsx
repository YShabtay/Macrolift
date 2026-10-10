import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Dumbbell from './DumbbellIcon';
import { REST_TIMER_FINISHED_EVENT } from '../utils/restTimerAlert';

const TOAST_MS = 4500;

/**
 * Full-screen visual alert for when a rest timer ends: a green pulse over the whole screen plus a large
 * toast. It exists because iOS WebKit has no vibration API and the silent switch mutes Web Audio, so
 * sound and haptics can't be relied on. Mount once; it listens for the event the timers fire.
 */
export default function RestFinishedAlert() {
  const [alertId, setAlertId] = useState<number | null>(null);

  useEffect(() => {
    const onFinished = () => setAlertId(Date.now());
    window.addEventListener(REST_TIMER_FINISHED_EVENT, onFinished);
    return () => window.removeEventListener(REST_TIMER_FINISHED_EVENT, onFinished);
  }, []);

  useEffect(() => {
    if (alertId === null) return;
    const id = setTimeout(() => setAlertId(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [alertId]);

  if (alertId === null) return null;

  return createPortal(
    <>
      {/* key restarts the CSS animation if a second timer finishes while the first alert is still showing */}
      <div key={`flash-${alertId}`} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[95] bg-lime-400 animate-rest-flash motion-reduce:hidden" />
      <div
        key={`toast-${alertId}`}
        role="alert"
        onClick={() => setAlertId(null)}
        className="fixed inset-x-4 top-[calc(max(env(safe-area-inset-top),0.75rem)+0.75rem)] z-[96] mx-auto flex max-w-md animate-toast-in cursor-pointer items-center gap-3 rounded-2xl border-2 border-lime-300 bg-lime-400 px-5 py-4 text-zinc-950 shadow-glow"
      >
        <Dumbbell className="h-7 w-7 shrink-0" strokeWidth={2.5} />
        <p className="text-lg font-extrabold leading-snug">זמן המנוחה הסתיים! צא לסט הבא 💪</p>
      </div>
    </>,
    document.body,
  );
}
