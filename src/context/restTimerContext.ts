import { createContext, useContext } from 'react';

export type RestTimerStatus = 'idle' | 'running' | 'paused' | 'finished';

/** What gets persisted: a wall-clock deadline while running, or the frozen remainder while paused. */
export interface RestTimerState {
  status: RestTimerStatus;
  label: string;
  durationSec: number;
  /** Epoch ms the countdown ends at (only while running). */
  endTime: number | null;
  /** Milliseconds left when paused. */
  remainingMs: number;
}

export interface RestTimerContextValue {
  status: RestTimerStatus;
  label: string;
  /** Total length of the current rest, including any "+30s" additions. */
  durationSec: number;
  remainingSec: number;
  /** Starts a fresh countdown. Call directly from a click handler: it unlocks audio and asks for notification permission. */
  start: (seconds: number, label: string) => void;
  pause: () => void;
  resume: () => void;
  addSeconds: (seconds: number) => void;
  /** Restarts the current duration from the top. */
  restart: () => void;
  /** Stops and clears the timer. */
  cancel: () => void;
}

export const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used inside <RestTimerProvider>');
  return ctx;
}
