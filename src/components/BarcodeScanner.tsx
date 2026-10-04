import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ScanBarcode, X } from 'lucide-react';
import type { FoodPer100g } from '../types/fitness';
import { lookupBarcode, normalizeBarcode, ProductNotFoundError } from '../services/barcodeLookup';

interface BarcodeScannerProps {
  /** The product that was found (already cached on the device). */
  onFound: (food: FoodPer100g) => void;
  onClose: () => void;
}

type Phase = 'starting' | 'scanning' | 'looking-up';

/** A message for the ways camera access fails, in plain words (permission denied is by far the most common). */
function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'אין הרשאה למצלמה. אפשר לאשר אותה בהגדרות הדפדפן, או להקליד את מספר הברקוד למטה.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'לא נמצאה מצלמה במכשיר. אפשר להקליד את מספר הברקוד למטה.';
  return 'לא ניתן להפעיל את המצלמה. אפשר להקליד את מספר הברקוד למטה.';
}

/**
 * Scans a product barcode with the camera and looks it up in Open Food Facts. The decoder (ZXing) is loaded only when this opens, so it costs
 * nothing until used. Works on iPhone Safari too, which has no built-in barcode detector. The number can also be typed.
 */
export default function BarcodeScanner({ onFound, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const busyRef = useRef(false);
  const stoppedRef = useRef(false);
  const onFoundRef = useRef(onFound);

  useEffect(() => {
    onFoundRef.current = onFound;
  });

  async function handleCode(raw: string) {
    const code = normalizeBarcode(raw);
    if (!code || busyRef.current) return;
    busyRef.current = true;
    setPhase('looking-up');
    setLookupError(null);
    try {
      const food = await lookupBarcode(code);
      if (!stoppedRef.current) onFoundRef.current(food);
    } catch (err) {
      if (stoppedRef.current) return;
      setLookupError(err instanceof ProductNotFoundError ? `המוצר ${code} לא נמצא במאגר. אפשר לחפש אותו בשם או להזין ידנית.` : err instanceof Error ? err.message : 'החיפוש נכשל');
      // Let the camera find the next barcode (after a pause, so the same unreadable one isn't hammered).
      setTimeout(() => {
        busyRef.current = false;
        if (!stoppedRef.current) setPhase('scanning');
      }, 1500);
      return;
    }
  }
  const handleCodeRef = useRef(handleCode);
  useEffect(() => {
    handleCodeRef.current = handleCode;
  });

  useEffect(() => {
    stoppedRef.current = false;
    let stop: (() => void) | undefined;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('הדפדפן הזה לא תומך בגישה למצלמה. אפשר להקליד את מספר הברקוד למטה.');
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');
        if (stoppedRef.current || !videoRef.current) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoRef.current, (result) => {
          if (result) void handleCodeRef.current(result.getText());
        });
        if (stoppedRef.current) {
          controls.stop();
          return;
        }
        stop = () => controls.stop();
        setPhase('scanning');
      } catch (err) {
        if (!stoppedRef.current) setCameraError(describeCameraError(err));
      }
    })();

    return () => {
      stoppedRef.current = true;
      stop?.();
    };
  }, []);

  const manualValid = normalizeBarcode(manualCode) !== null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="סריקת ברקוד" dir="rtl" className="fixed inset-0 z-[80] flex flex-col bg-zinc-950 text-zinc-100 animate-fade-in">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="flex items-center gap-2">
          <ScanBarcode className="h-5 w-5 text-lime-400" />
          <h3 className="font-bold">סריקת ברקוד</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="סגירה" className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative mx-4 flex-1 overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-cover" />
        {!cameraError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-[80%] rounded-xl border-2 border-lime-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}
        {phase === 'starting' && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            מפעיל מצלמה...
          </div>
        )}
        {phase === 'looking-up' && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-zinc-950/80 py-3 text-sm font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-lime-400" />
            מחפש את המוצר...
          </div>
        )}
        {cameraError && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm leading-relaxed text-zinc-300">{cameraError}</p>}
      </div>

      <div className="px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        {lookupError && <p className="mb-2 text-center text-xs font-semibold text-amber-400">{lookupError}</p>}
        {!cameraError && phase === 'scanning' && !lookupError && <p className="mb-2 text-center text-xs text-zinc-400">כוונו את הברקוד למסגרת</p>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manualValid) void handleCode(manualCode);
          }}
        >
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.replace(/[^\d\s-]/g, ''))}
            inputMode="numeric"
            dir="ltr"
            placeholder="או הקלידו את מספר הברקוד"
            aria-label="מספר ברקוד"
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-center text-sm tabular-nums text-zinc-100 outline-none focus:border-lime-400"
          />
          <button type="submit" disabled={!manualValid || phase === 'looking-up'} className="btn-primary px-5 disabled:opacity-40">
            חפש
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
