import { useEffect, useState } from 'react';
import { todayIso } from '../utils/weightCalculations';

/**
 * Today's local date (YYYY-MM-DD) as React state that stays correct while the app is open.
 * A PWA can sit in the background for days, so a value computed once at render would keep
 * counting the previous week - this re-reads the date when the app regains focus/visibility
 * and on a slow timer, and only triggers a re-render when the day actually changed.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayIso);

  useEffect(() => {
    const refresh = () => setToday(todayIso());
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    const id = setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      clearInterval(id);
    };
  }, []);

  return today;
}
