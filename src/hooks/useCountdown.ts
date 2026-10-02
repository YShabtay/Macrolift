import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

interface UseCountdownOptions {
  durationSec: number;
  autoStart?: boolean;
  /** Called once each time the countdown reaches zero while running. */
  onFinish?: () => void;
}

/**
 * Countdown that is computed from a wall-clock deadline (`endTime = Date.now() + remainingMs`) instead of
 * counting 1-second ticks. Mobile browsers throttle or freeze timers while the app is backgrounded
 * or the screen is locked, so tick-counting loses time; a deadline stays exact, and the display
 * snaps to the true remaining time the moment the app is visible again.
 */
export function useCountdown({ durationSec, autoStart = false, onFinish }: UseCountdownOptions) {
  const [remaining, setRemaining] = useState(durationSec);
  const [running, setRunning] = useState(autoStart);
  const endTimeRef = useRef<number | null>(null);
  const remainingMsRef = useRef(durationSec * 1000);
  const hasFinishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  const tick = useCallback(() => {
    const endTime = endTimeRef.current;
    if (endTime === null) return;
    const msLeft = endTime - Date.now();
    if (msLeft <= 0) {
      endTimeRef.current = null;
      remainingMsRef.current = 0;
      setRemaining(0);
      setRunning(false);
      if (!hasFinishedRef.current) {
        hasFinishedRef.current = true;
        onFinishRef.current?.();
      }
      return;
    }
    setRemaining(Math.ceil(msLeft / 1000));
  }, []);

  useEffect(() => {
    if (!running) return;
    // Mount-time autoStart (and any other path that didn't set a deadline) begins counting from here.
    if (endTimeRef.current === null) endTimeRef.current = Date.now() + remainingMsRef.current;

    const id = setInterval(tick, TICK_MS);
    const onWake = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('pageshow', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('pageshow', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [running, tick]);

  const start = useCallback(() => {
    if (remainingMsRef.current <= 0) return;
    endTimeRef.current = Date.now() + remainingMsRef.current;
    hasFinishedRef.current = false;
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (endTimeRef.current !== null) remainingMsRef.current = Math.max(endTimeRef.current - Date.now(), 0);
    endTimeRef.current = null;
    setRemaining(Math.ceil(remainingMsRef.current / 1000));
    setRunning(false);
  }, []);

  /** Sets a fresh duration and stops; call `start()` afterwards to run it. */
  const reset = useCallback((seconds: number) => {
    endTimeRef.current = null;
    remainingMsRef.current = seconds * 1000;
    hasFinishedRef.current = false;
    setRemaining(seconds);
    setRunning(false);
  }, []);

  return { remaining, running, start, pause, reset };
}

/** Count-up clock with the same drift protection: elapsed time is derived from timestamps, not accumulated ticks. */
export function useStopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);

  const tick = useCallback(() => {
    if (startedAtRef.current === null) return;
    setElapsed(Math.floor((accumulatedMsRef.current + Date.now() - startedAtRef.current) / 1000));
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, TICK_MS);
    const onWake = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('pageshow', onWake);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, [running, tick]);

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startedAtRef.current !== null) accumulatedMsRef.current += Date.now() - startedAtRef.current;
    startedAtRef.current = null;
    setElapsed(Math.floor(accumulatedMsRef.current / 1000));
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    accumulatedMsRef.current = 0;
    setElapsed(0);
    setRunning(false);
  }, []);

  return { elapsed, running, start, pause, reset };
}
