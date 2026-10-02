/**
 * Shared "rest timer finished" alert: three synthesized beeps (Web Audio - no audio file, no network),
 * a vibration pattern where supported, and a page-wide visual alert (screen flash + big toast) for
 * devices that can't do either - iOS WebKit has no `navigator.vibrate`, and the phone's silent switch
 * mutes Web Audio.
 *
 * iOS Safari only allows creating or resuming an AudioContext synchronously inside a user gesture
 * (a tap/click handler). If that first happens later - e.g. from a timer callback when the countdown
 * reaches zero - the browser silently refuses to play. So the context is created once, up front, and
 * callers MUST call `unlockRestTimerAudio()` directly inside the click handler that starts or selects
 * a rest timer (not in a useEffect, not after an await). It resumes the context and plays a silent
 * buffer, which is what makes iOS treat the context as user-approved for the later beeps.
 */

let sharedAudioContext: AudioContext | null = null;

/** Window event fired when a rest countdown reaches zero; the visual alert component listens for it. */
export const REST_TIMER_FINISHED_EVENT = 'macrolift:rest-timer-finished';

const BEEP_SEQUENCE_HZ = [880, 880, 1046.5];
const BEEP_DURATION_S = 0.15;
const BEEP_GAP_S = 0.12;
const BEEP_PEAK_GAIN = 0.5;

function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function getContext(): AudioContext | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') sharedAudioContext = new Ctor();
  return sharedAudioContext;
}

/** Call synchronously inside the click handler that starts a rest timer - see module docs. */
export function unlockRestTimerAudio(): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    // Safari can report 'interrupted' (after a call, or returning from the background) as well as 'suspended'.
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);

    // A one-sample silent buffer played inside the gesture is what makes iOS approve later sounds.
    const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = silent;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Web Audio unavailable - the finish alert will just skip the beeps.
  }
}

function scheduleBeeps(ctx: AudioContext): void {
  BEEP_SEQUENCE_HZ.forEach((frequency, i) => {
    const start = ctx.currentTime + 0.02 + i * (BEEP_DURATION_S + BEEP_GAP_S);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, start);
    // Near-instant attack avoids a click; the exponential decay makes each beep short and soft-edged.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(BEEP_PEAK_GAIN, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + BEEP_DURATION_S);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + BEEP_DURATION_S + 0.02);
  });
}

/** Three clear beeps (880 / 880 / 1046 Hz, 150 ms each) through the shared, pre-unlocked AudioContext. */
export function playRestTimerChime(): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'running') {
      scheduleBeeps(ctx);
    } else {
      // Returning from the background leaves the context suspended: resume first, then schedule against the live clock.
      void ctx
        .resume()
        .then(() => scheduleBeeps(ctx))
        .catch(() => undefined);
    }
  } catch {
    // Silently skip - a missed beep shouldn't break the timer.
  }
}

/** Short-long-short vibration pattern, on devices/browsers that support it (not iOS WebKit). */
export function vibrateRestTimerAlert(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch {
    // Vibration unavailable - ignore.
  }
}

/** Shows the on-screen alert (screen flash + big toast); `RestFinishedAlert` listens for this. */
export function showRestTimerFinishedVisual(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REST_TIMER_FINISHED_EVENT));
}

/** Beeps, vibration and the on-screen alert together - call once when a countdown hits 0 while the app is in view. */
export function fireRestTimerFinishedAlert(): void {
  playRestTimerChime();
  vibrateRestTimerAlert();
  showRestTimerFinishedVisual();
}
