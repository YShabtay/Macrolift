import { useSyncExternalStore } from 'react';

/** The app's phone layout: the same breakpoint as the tab bar (below Tailwind's `md`, 768px). */
const MOBILE_QUERY = '(max-width: 767.98px)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** True on a phone-sized screen. Used where the phone gets a shorter layout and a computer keeps the full one. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}
