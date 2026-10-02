import { useRef, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Images, X } from 'lucide-react';

interface PhotoSourceSheetProps {
  title?: string;
  onFile: (file: File) => void;
  onClose: () => void;
}

/**
 * Lets the user choose between shooting a new photo and picking an existing one. These must be two
 * separate inputs: `capture` forces the live camera on iOS/Android and hides the photo library, so
 * the gallery option has to use an input without it. Both inputs stay mounted until a file is
 * chosen (iOS drops the selection if the input unmounts while the picker is open).
 */
export default function PhotoSourceSheet({ title = 'הוספת תמונת ארוחה', onFile, onClose }: PhotoSourceSheetProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    onFile(file);
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-zinc-950/70 p-4 backdrop-blur-sm animate-fade-in sm:items-center"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex w-full max-w-sm flex-col gap-3 p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-3 rounded-xl border border-lime-400/40 bg-lime-400/10 px-4 py-3.5 text-right transition hover:border-lime-400/70 hover:bg-lime-400/20"
        >
          <Camera className="h-5 w-5 shrink-0 text-lime-700 dark:text-lime-400" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">צלם עכשיו</span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex items-center gap-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3.5 text-right transition hover:border-lime-400/50"
        >
          <Images className="h-5 w-5 shrink-0 text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">בחר מהגלריה</span>
        </button>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>
    </div>,
    document.body,
  );
}
