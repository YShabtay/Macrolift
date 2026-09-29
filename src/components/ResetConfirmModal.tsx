import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ResetConfirmModalProps {
  onConfirm: () => void;
  onClose: () => void;
}

export default function ResetConfirmModal({ onConfirm, onClose }: ResetConfirmModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex w-full max-w-sm flex-col gap-4 p-5 shadow-glow animate-slide-up sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">האם אתה בטוח?</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="shrink-0 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          כל היסטוריית האימונים והשקילות, יומן התזונה, תמונות ההתקדמות ומדידות ההיקפים - <b>יימחקו לצמיתות</b> מהמכשיר
          הזה, ושאלון ה-Onboarding ייפתח מחדש. פעולה זו אינה הפיכה.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
            כן, מחק את כל הנתונים
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            ביטול
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
