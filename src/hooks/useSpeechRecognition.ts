import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API isn't in every TS lib version and Safari ships it prefixed, so describe just what we use.
interface RecognitionResultItem {
  readonly transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0: RecognitionResultItem;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'הגישה למיקרופון נחסמה. אפשרו מיקרופון לאתר בהגדרות הדפדפן ונסו שוב.',
  'service-not-allowed': 'זיהוי הדיבור חסום במכשיר זה. אפשר להקליד את התיאור במקום.',
  'audio-capture': 'לא נמצא מיקרופון זמין במכשיר.',
  'no-speech': 'לא זוהה דיבור. נסו שוב וספרו מה אכלתם.',
  network: 'אין חיבור לשירות זיהוי הדיבור. בדקו את החיבור לרשת, או הקלידו את התיאור.',
};

interface UseSpeechRecognitionOptions {
  lang?: string;
  /** Called with the full transcript so far, on every update while listening. */
  onTranscript: (text: string) => void;
  /** Called once when listening stops (by the user or on its own) with the final transcript. */
  onFinished: (text: string) => void;
}

/**
 * Thin wrapper over the browser's speech recognition (webkitSpeechRecognition on Safari/Chrome),
 * defaulting to Hebrew. `isSupported` is false in browsers without it (e.g. Firefox) so callers can
 * offer typing instead. Starting must be best-effort: iOS only allows it from a user gesture.
 */
export function useSpeechRecognition({ lang = 'he-IL', onTranscript, onFinished }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const transcriptRef = useRef('');
  const wasAbortedRef = useRef(false);
  const callbacksRef = useRef({ onTranscript, onFinished });

  useEffect(() => {
    callbacksRef.current = { onTranscript, onFinished };
  });

  const isSupported = getRecognitionCtor() !== undefined;

  const start = useCallback((): boolean => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognitionRef.current) return false;
    try {
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      transcriptRef.current = '';
      wasAbortedRef.current = false;

      recognition.onresult = (e) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) text += `${e.results[i][0].transcript} `;
        transcriptRef.current = text.trim();
        callbacksRef.current.onTranscript(transcriptRef.current);
      };
      recognition.onerror = (e) => {
        if (e.error === 'aborted') return;
        setError(ERROR_MESSAGES[e.error] ?? 'זיהוי הדיבור נכשל. נסו שוב או הקלידו את התיאור.');
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
        if (!wasAbortedRef.current) callbacksRef.current.onFinished(transcriptRef.current);
      };

      setError(null);
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      return true;
    } catch {
      recognitionRef.current = null;
      return false;
    }
  }, [lang]);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  const abort = useCallback(() => {
    wasAbortedRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  // Never leave the microphone open after the component goes away.
  useEffect(() => () => abort(), [abort]);

  return { isSupported, isListening, error, start, stop, abort };
}
