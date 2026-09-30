/**
 * Shared "rest timer finished" alert: a two-tone chime (Web Audio, no audio file needed) plus
 * a vibration pattern on supporting devices.
 *
 * iOS Safari only allows creating or resuming an AudioContext synchronously inside a user
 * gesture (a tap/click handler) - if that first happens later, e.g. from a setInterval/setTimeout
 * callback when the countdown reaches zero, the browser silently refuses to play sound. So the
 * context is created once, up front, and callers MUST call `unlockRestTimerAudio()` directly
 * inside the click handler that starts a rest timer (not in a useEffect, not after an await) -
 * then `playRestTimerChime()` can safely play through that already-unlocked context whenever the
 * countdown actually finishes, including on iPhone.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContextCtor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/** Call synchronously inside the click handler that starts a rest timer - see module docs. */
export function unlockRestTimerAudio(): void {
  try {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    if (!sharedAudioContext) {
      sharedAudioContext = new Ctor();
    }
    if (sharedAudioContext.state === 'suspended') {
      void sharedAudioContext.resume();
    }
  } catch {
    // Web Audio unavailable - the finish alert will just skip the beep.
  }
}

/** A short, pleasant two-tone chime played through the shared (pre-unlocked) AudioContext. */
export function playRestTimerChime(): void {
  try {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    if (!sharedAudioContext) sharedAudioContext = new Ctor();
    const ctx = sharedAudioContext;
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.05);
    };

    playTone(880, 0, 0.35);
    playTone(1175, 0.18, 0.45);
  } catch {
    // Silently skip - a missed beep shouldn't break the timer.
  }
}

/** Short-long-short vibration pattern, on devices/browsers that support it. */
export function vibrateRestTimerAlert(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch {
    // Vibration unavailable - ignore.
  }
}

/** Plays the chime and triggers the vibration together - call once when a countdown hits 0. */
export function fireRestTimerFinishedAlert(): void {
  playRestTimerChime();
  vibrateRestTimerAlert();
}
