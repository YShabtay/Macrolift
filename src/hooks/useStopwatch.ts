import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

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
