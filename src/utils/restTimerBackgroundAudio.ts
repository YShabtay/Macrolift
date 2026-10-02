/**
 * Keeps a running rest timer alive when the iPhone is locked, and sounds the alarm there.
 *
 * iOS freezes a page's JavaScript shortly after the screen locks - unless the page is playing audio.
 * So while a timer runs we loop an inaudible audio track in an <audio> element (a "media playback"
 * session), which keeps the timer's code running. When the timer ends we swap that track for an alarm
 * track: three beeps followed by silence, repeating every 5 seconds. The alarm is a real audio file
 * played natively, so it keeps repeating on the lock screen even if the page's script stops again, until
 * the user opens the app (or stops playback from the lock screen controls).
 *
 * Trade-offs: holding a playback session pauses music from other apps (Spotify, Apple Music) for the
 * rest, and iOS doesn't strictly guarantee this keeps a PWA awake - hence the preference toggle and the
 * wake lock / notification fallbacks. Playback may only first start inside a user gesture, so
 * `armBackgroundAudio()` must be called synchronously from the click that starts the timer.
 */

const PREFERENCE_KEY = 'macrolift-rest-background-audio';
const SAMPLE_RATE = 11025;
const ALARM_PERIOD_S = 5;
const ALARM_REPEATS = 24; // ~2 minutes of repeating beeps, then it falls silent on its own
const BEEP_SEQUENCE_HZ = [880, 880, 1046.5];
const BEEP_DURATION_S = 0.15;
const BEEP_GAP_S = 0.12;

type TrackKind = 'silence' | 'alarm';

let audioEl: HTMLAudioElement | null = null;
let silenceUrl: string | null = null;
let alarmUrl: string | null = null;
let currentTrack: TrackKind | null = null;

/** Whether the user allows the background-audio trick (default on). */
export function isBackgroundAudioEnabled(): boolean {
  try {
    return localStorage.getItem(PREFERENCE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setBackgroundAudioEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Not persisted; applies for this session only.
  }
  if (!enabled) stopBackgroundAudio();
}

function encodeWav(samples: Int16Array): Blob {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataBytes, true);
  new Int16Array(buffer, 44).set(samples);
  return new Blob([buffer], { type: 'audio/wav' });
}

/** One second of effectively-silent audio (±1 LSB) - truly all-zero data can be treated as "nothing playing". */
function buildSilenceTrack(): Blob {
  const samples = new Int16Array(SAMPLE_RATE);
  for (let i = 0; i < samples.length; i++) samples[i] = i % 2 === 0 ? 1 : -1;
  return encodeWav(samples);
}

/** Three beeps (880 / 880 / 1046 Hz, 150 ms) then silence, repeated every 5 s. */
function buildAlarmTrack(): Blob {
  const period = new Int16Array(SAMPLE_RATE * ALARM_PERIOD_S);
  BEEP_SEQUENCE_HZ.forEach((frequency, i) => {
    const start = Math.round(i * (BEEP_DURATION_S + BEEP_GAP_S) * SAMPLE_RATE);
    const length = Math.round(BEEP_DURATION_S * SAMPLE_RATE);
    for (let n = 0; n < length; n++) {
      const t = n / SAMPLE_RATE;
      const attack = Math.min(n / (0.008 * SAMPLE_RATE), 1);
      const decay = Math.exp((-t / BEEP_DURATION_S) * 4);
      period[start + n] = Math.round(Math.sin(2 * Math.PI * frequency * t) * attack * decay * 0.85 * 32767);
    }
  });
  const samples = new Int16Array(period.length * ALARM_REPEATS);
  for (let r = 0; r < ALARM_REPEATS; r++) samples.set(period, r * period.length);
  return encodeWav(samples);
}

function ensureElement(): HTMLAudioElement | null {
  if (typeof document === 'undefined' || typeof Audio === 'undefined') return null;
  if (!audioEl) {
    silenceUrl = URL.createObjectURL(buildSilenceTrack());
    alarmUrl = URL.createObjectURL(buildAlarmTrack());
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.setAttribute('playsinline', '');
    configureMediaSession();
  }
  return audioEl;
}

/** Lock-screen presentation, and a way to stop the alarm from the lock screen controls. */
function configureMediaSession() {
  try {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'טיימר מנוחה', artist: 'MacroLift' });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (currentTrack === 'alarm') stopBackgroundAudio();
      else void audioEl?.play().catch(() => undefined);
    });
    navigator.mediaSession.setActionHandler('stop', () => stopBackgroundAudio());
  } catch {
    // Media Session unsupported - cosmetic only.
  }
}

async function playTrack(kind: TrackKind): Promise<boolean> {
  const el = ensureElement();
  const url = kind === 'silence' ? silenceUrl : alarmUrl;
  if (!el || !url) return false;
  try {
    if (currentTrack !== kind) {
      el.src = url;
      currentTrack = kind;
    }
    el.loop = kind === 'silence';
    el.currentTime = 0;
    await el.play();
    return true;
  } catch {
    // Autoplay policy refused (no gesture yet) or no audio output.
    return false;
  }
}

/**
 * Starts the inaudible keep-alive loop. Call synchronously inside the click that starts or resumes the
 * timer - that gesture is what lets the element play now and swap to the alarm track later.
 */
export function armBackgroundAudio(): void {
  if (!isBackgroundAudioEnabled()) return;
  void playTrack('silence');
}

/** Timer ended while the app is hidden/locked: replace the silence with the repeating alarm. Resolves false if it can't play. */
export function startBackgroundAlarm(): Promise<boolean> {
  if (!isBackgroundAudioEnabled()) return Promise.resolve(false);
  return playTrack('alarm');
}

/** Stops whatever is playing (keep-alive or alarm) and frees the audio session. */
export function stopBackgroundAudio(): void {
  try {
    audioEl?.pause();
    if (audioEl) audioEl.currentTime = 0;
  } catch {
    // Nothing to stop.
  }
  currentTrack = null;
}

export function isBackgroundAlarmPlaying(): boolean {
  return currentTrack === 'alarm' && audioEl !== null && !audioEl.paused;
}
