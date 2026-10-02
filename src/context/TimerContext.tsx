import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RestTimerContext, type RestTimerContextValue, type RestTimerState } from './restTimerContext';
import {
  playRestTimerChime,
  showRestTimerFinishedVisual,
  unlockRestTimerAudio,
  vibrateRestTimerAlert,
} from '../utils/restTimerAlert';
import { notifyRestTimerFinished, requestNotificationPermissionOnce } from '../utils/restTimerNotifications';

const STORAGE_KEY = 'macrolift-rest-timer';
const TICK_MS = 250;
/** Beeps are only worth playing close to the real finish; minutes late they are just confusing. */
const MAX_OVERDUE_FOR_BEEP_MS = 5000;

const IDLE: RestTimerState = { status: 'idle', label: '', durationSec: 0, endTime: null, remainingMs: 0 };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

interface LoadedTimer {
  state: RestTimerState;
  /** Set when the stored deadline already passed while the app was closed: how long ago it ended. */
  overdueMs: number | null;
}

function loadPersisted(): LoadedTimer {
  const state = readPersisted();
  if (state.status === 'running' && state.endTime !== null && state.endTime <= Date.now()) {
    return { state: { ...state, status: 'finished', endTime: null, remainingMs: 0 }, overdueMs: Date.now() - state.endTime };
  }
  return { state, overdueMs: null };
}

function readPersisted(): RestTimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return IDLE;
    const p = JSON.parse(raw) as Partial<RestTimerState>;
    if (!isFiniteNumber(p.durationSec) || p.durationSec <= 0) return IDLE;
    const base = { label: typeof p.label === 'string' ? p.label : '', durationSec: p.durationSec };
    if (p.status === 'running' && isFiniteNumber(p.endTime)) {
      return { ...base, status: 'running', endTime: p.endTime, remainingMs: 0 };
    }
    if (p.status === 'paused' && isFiniteNumber(p.remainingMs) && p.remainingMs > 0) {
      return { ...base, status: 'paused', endTime: null, remainingMs: p.remainingMs };
    }
    if (p.status === 'finished') return { ...base, status: 'finished', endTime: null, remainingMs: 0 };
  } catch {
    // Corrupt or inaccessible storage: start clean.
  }
  return IDLE;
}

function persist(state: RestTimerState) {
  try {
    if (state.status === 'idle') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode: the timer still works for this session.
  }
}

/**
 * App-wide rest timer. The state is a wall-clock deadline (`endTime = Date.now() + duration`) mirrored to
 * localStorage, never a counted-down number, so it survives tab switches, backgrounding, screen lock and
 * even a reload: on every tick or return-to-app the remaining time is recomputed from `Date.now()`.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadPersisted);
  const [timer, setTimer] = useState<RestTimerState>(initial.state);
  const [now, setNow] = useState(Date.now);
  // Mirrors `timer` synchronously so back-to-back handlers (double tap) never act on stale state.
  const timerRef = useRef(timer);
  const awayOverdueMsRef = useRef(initial.overdueMs);
  // The visual alert waits for the app to be visible: shown when the user comes back to a finished timer.
  const pendingVisualRef = useRef(false);

  const commit = useCallback((next: RestTimerState) => {
    timerRef.current = next;
    setTimer(next);
    persist(next);
    setNow(Date.now());
  }, []);

  /** Beeps/vibration/notification/visual for a timer that has just ended (or ended while the app was away). */
  const runFinishAlerts = useCallback((overdueMs: number) => {
    if (overdueMs <= MAX_OVERDUE_FOR_BEEP_MS) {
      playRestTimerChime();
      vibrateRestTimerAlert();
    }
    if (document.visibilityState === 'visible') {
      showRestTimerFinishedVisual();
    } else {
      pendingVisualRef.current = true;
      void notifyRestTimerFinished();
    }
  }, []);

  const finish = useCallback(
    (overdueMs: number) => {
      commit({ ...timerRef.current, status: 'finished', endTime: null, remainingMs: 0 });
      runFinishAlerts(overdueMs);
    },
    [commit, runFinishAlerts],
  );

  const tick = useCallback(() => {
    const t = Date.now();
    setNow(t);
    const current = timerRef.current;
    if (current.status === 'running' && current.endTime !== null && current.endTime <= t) {
      finish(t - current.endTime);
    }
  }, [finish]);

  const isRunning = timer.status === 'running';
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [isRunning, tick]);

  // Returning to the app: recompute from the clock right away, and show any alert that was held back.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      tick();
      if (pendingVisualRef.current) {
        pendingVisualRef.current = false;
        showRestTimerFinishedVisual();
      }
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('pageshow', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('pageshow', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [tick]);

  // The deadline passed while the app was closed or frozen: settle into "finished" and tell the user now.
  useEffect(() => {
    const overdueMs = awayOverdueMsRef.current;
    if (overdueMs === null) return;
    awayOverdueMsRef.current = null;
    persist(timerRef.current);
    runFinishAlerts(overdueMs);
  }, [runFinishAlerts]);

  const start = useCallback(
    (seconds: number, label: string) => {
      if (!(seconds > 0)) return;
      // These two only work synchronously inside the user's tap, so they run before anything else.
      unlockRestTimerAudio();
      requestNotificationPermissionOnce();
      pendingVisualRef.current = false;
      commit({ status: 'running', label, durationSec: seconds, endTime: Date.now() + seconds * 1000, remainingMs: 0 });
    },
    [commit],
  );

  const pause = useCallback(() => {
    const t = timerRef.current;
    if (t.status !== 'running' || t.endTime === null) return;
    commit({ ...t, status: 'paused', endTime: null, remainingMs: Math.max(t.endTime - Date.now(), 0) });
  }, [commit]);

  const resume = useCallback(() => {
    const t = timerRef.current;
    if (t.status !== 'paused' || t.remainingMs <= 0) return;
    unlockRestTimerAudio();
    commit({ ...t, status: 'running', endTime: Date.now() + t.remainingMs, remainingMs: 0 });
  }, [commit]);

  const addSeconds = useCallback(
    (seconds: number) => {
      const t = timerRef.current;
      unlockRestTimerAudio();
      if (t.status === 'running' && t.endTime !== null) {
        commit({ ...t, endTime: t.endTime + seconds * 1000, durationSec: t.durationSec + seconds });
      } else if (t.status === 'paused') {
        commit({ ...t, remainingMs: t.remainingMs + seconds * 1000, durationSec: t.durationSec + seconds });
      } else {
        // Nothing active (or it just finished): "+30s" begins a fresh short rest.
        pendingVisualRef.current = false;
        commit({
          status: 'running',
          label: t.label || 'מנוחה',
          durationSec: seconds,
          endTime: Date.now() + seconds * 1000,
          remainingMs: 0,
        });
      }
    },
    [commit],
  );

  const restart = useCallback(() => {
    const t = timerRef.current;
    if (t.status === 'idle' || t.durationSec <= 0) return;
    unlockRestTimerAudio();
    pendingVisualRef.current = false;
    commit({ ...t, status: 'running', endTime: Date.now() + t.durationSec * 1000, remainingMs: 0 });
  }, [commit]);

  const cancel = useCallback(() => {
    pendingVisualRef.current = false;
    commit(IDLE);
  }, [commit]);

  const remainingSec =
    timer.status === 'running' && timer.endTime !== null
      ? Math.max(Math.ceil((timer.endTime - now) / 1000), 0)
      : timer.status === 'paused'
        ? Math.ceil(timer.remainingMs / 1000)
        : 0;

  const value = useMemo<RestTimerContextValue>(
    () => ({
      status: timer.status,
      label: timer.label,
      durationSec: timer.durationSec,
      remainingSec,
      start,
      pause,
      resume,
      addSeconds,
      restart,
      cancel,
    }),
    [timer.status, timer.label, timer.durationSec, remainingSec, start, pause, resume, addSeconds, restart, cancel],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}
