import { useCallback, useRef, useState } from 'react';

interface UseStepCounterResult {
  isSupported: boolean;
  isActive: boolean;
  liveSteps: number;
  error: string | null;
  start: () => Promise<void>;
  /** Stops listening and returns the final counted step total for this session. */
  stop: () => number;
}

const PEAK_THRESHOLD = 1.2; // m/s^2 deviation from gravity needed to register a step
const RESET_THRESHOLD = 0.6;
const MIN_STEP_INTERVAL_MS = 300;
const GRAVITY = 9.8;

type MotionPermissionAPI = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * Counts steps in real time from the device's accelerometer via DeviceMotionEvent,
 * using simple peak detection on acceleration magnitude. Desktop browsers (and any
 * device without a motion sensor) report isSupported=false.
 */
export function useStepCounter(): UseStepCounterResult {
  const [isActive, setIsActive] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stepsRef = useRef(0);
  const lastStepTimeRef = useRef(0);
  const risingRef = useRef(false);
  const listenerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  const isSupported = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    const delta = magnitude - GRAVITY;
    const now = Date.now();

    if (delta > PEAK_THRESHOLD && !risingRef.current && now - lastStepTimeRef.current > MIN_STEP_INTERVAL_MS) {
      risingRef.current = true;
      lastStepTimeRef.current = now;
      stepsRef.current += 1;
      setLiveSteps(stepsRef.current);
    } else if (delta < RESET_THRESHOLD) {
      risingRef.current = false;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!isSupported) {
      setError('חיישן תנועה אינו זמין במכשיר זה');
      return;
    }

    const motionApi = DeviceMotionEvent as MotionPermissionAPI;
    if (typeof motionApi.requestPermission === 'function') {
      try {
        const result = await motionApi.requestPermission();
        if (result !== 'granted') {
          setError('הגישה לחיישן התנועה נדחתה');
          return;
        }
      } catch {
        setError('לא ניתן לבקש הרשאה לחיישן התנועה');
        return;
      }
    }

    stepsRef.current = 0;
    lastStepTimeRef.current = 0;
    risingRef.current = false;
    setLiveSteps(0);
    listenerRef.current = handleMotion;
    window.addEventListener('devicemotion', handleMotion);
    setIsActive(true);
  }, [isSupported, handleMotion]);

  const stop = useCallback(() => {
    if (listenerRef.current) {
      window.removeEventListener('devicemotion', listenerRef.current);
      listenerRef.current = null;
    }
    setIsActive(false);
    return stepsRef.current;
  }, []);

  return { isSupported, isActive, liveSteps, error, start, stop };
}
