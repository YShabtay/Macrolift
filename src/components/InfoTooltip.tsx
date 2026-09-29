import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  text: string;
}

/**
 * A small "i" button that opens a centered info popup (via portal, so it is
 * never clipped or mis-positioned by an ancestor with overflow/backdrop-filter).
 */
export default function InfoTooltip({ title, text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`מידע נוסף: ${title}`}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-600 dark:text-zinc-500 transition hover:text-lime-700 dark:hover:text-lime-400"
      >
        <Info className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          >
            <div
              className="glass-card neon-border w-full max-w-xs p-5 shadow-glow animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{title}</h4>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="סגירה"
                  className="shrink-0 text-zinc-600 dark:text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{text}</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
