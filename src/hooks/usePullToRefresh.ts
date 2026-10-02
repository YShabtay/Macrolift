import { useEffect, useRef, useState } from 'react';

/** Distance (px, after resistance) the user must pull past to trigger a refresh. */
export const PULL_THRESHOLD_PX = 65;
/** The pull can't stretch further than this. */
export const MAX_PULL_PX = 80;
/** Finger travel is multiplied by this, so the page feels elastic instead of 1:1. */
export const PULL_RESISTANCE = 0.45;
/** Where the page rests while the refresh runs. */
const REFRESHING_HOLD_PX = 56;
/** Finger must travel at least this far down (and mostly vertically) before the gesture is treated as a pull. */
const ENGAGE_PX = 8;
/** Keeps the spinner visible long enough to read as feedback, even when the refresh itself is instant. */
const MIN_REFRESH_MS = 700;

type Phase = 'idle' | 'pulling' | 'refreshing';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
}

function isScrolledToTop(): boolean {
  if (window.scrollY > 0) return false;
  // The dashboard's <main> is an overflow container; when it owns the scroll, check it too.
  const main = document.querySelector('main');
  return !main || main.scrollTop <= 0;
}

/** True when the touch began somewhere a pull must not start: inside a modal/drawer, or in a list scrolled away from its top. */
function isBlockedTarget(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el.matches('[role="dialog"], [data-no-pull-refresh]')) return true;
    const style = getComputedStyle(el);
    if (style.position === 'fixed' && el.matches('.inset-0')) return true;
    const scrollsVertically = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
    if (scrollsVertically && el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * Custom pull-to-refresh for touch devices: iOS turns off the browser's own gesture in installed PWAs. Only engages from
 * the very top of the page, on a mostly-vertical downward drag, with elastic resistance. touchstart/touchend are passive;
 * touchmove is the one non-passive listener, because it must cancel the native rubber-band while a pull is in progress -
 * and it only ever does that during an active pull, so ordinary scrolling is never blocked.
 */
export function usePullToRefresh({ onRefresh, enabled = true }: UsePullToRefreshOptions) {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const engagedRef = useRef(false);
  const pullRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled) return;

    const setPullDistance = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };
    const setPhaseValue = (value: Phase) => {
      phaseRef.current = value;
      setPhase(value);
    };

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current === 'refreshing' || e.touches.length !== 1) return;
      startRef.current = null;
      engagedRef.current = false;
      if (!isScrolledToTop() || isBlockedTarget(e.target)) return;
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    function onTouchMove(e: TouchEvent) {
      const start = startRef.current;
      if (!start || phaseRef.current === 'refreshing') return;

      const dy = e.touches[0].clientY - start.y;
      const dx = e.touches[0].clientX - start.x;

      if (!engagedRef.current) {
        // Upward or sideways movement means a normal scroll / swipe: hand the gesture back to the browser.
        if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
          startRef.current = null;
          return;
        }
        if (dy < ENGAGE_PX) return;
        engagedRef.current = true;
        setPhaseValue('pulling');
      }

      if (!isScrolledToTop()) {
        // The page started scrolling after all - abandon the pull.
        startRef.current = null;
        engagedRef.current = false;
        setPullDistance(0);
        setPhaseValue('idle');
        return;
      }

      if (e.cancelable) e.preventDefault(); // stop the native overscroll bounce while pulling
      setPullDistance(Math.min(Math.max(dy, 0) * PULL_RESISTANCE, MAX_PULL_PX));
    }

    async function onTouchEnd() {
      const wasEngaged = engagedRef.current;
      startRef.current = null;
      engagedRef.current = false;
      if (!wasEngaged) return;

      if (pullRef.current >= PULL_THRESHOLD_PX) {
        setPhaseValue('refreshing');
        setPullDistance(REFRESHING_HOLD_PX);
        const startedAt = Date.now();
        try {
          await onRefreshRef.current();
        } catch {
          // A failed refresh just ends the spinner; the screen keeps its current data.
        }
        const remaining = MIN_REFRESH_MS - (Date.now() - startedAt);
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setPullDistance(0);
      setPhaseValue('idle');
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled]);

  return {
    pull,
    isPulling: phase === 'pulling',
    isRefreshing: phase === 'refreshing',
    /** 0 at rest, 1 once the release threshold is reached. */
    progress: Math.min(pull / PULL_THRESHOLD_PX, 1),
  };
}
