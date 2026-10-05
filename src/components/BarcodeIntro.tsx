import { createPortal } from 'react-dom';
import { Database, PencilLine, ScanBarcode } from 'lucide-react';

interface BarcodeIntroProps {
  /** The user understood and wants to scan: the camera opens next. */
  onContinue: () => void;
  onCancel: () => void;
}

/** One-time note before the first scan: the database doesn't have every product, and values typed in once are remembered. */
export default function BarcodeIntro({ onContinue, onCancel }: BarcodeIntroProps) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="לפני שסורקים ברקוד"
      dir="rtl"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/80 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        className="glass-card neon-border w-full max-w-md rounded-b-none p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-glow animate-slide-up sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400/15 text-lime-700 dark:text-lime-400">
            <ScanBarcode className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">לפני שסורקים ברקוד</h3>
        </div>

        <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <li className="flex items-start gap-2.5">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-lime-700 dark:text-lime-400" />
            <span>לא כל המוצרים נמצאים במאגר הברקודים, וחלק מהם בלי ערכי תזונה.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-lime-700 dark:text-lime-400" />
            <span>אם מוצר חסר, תוכלו להזין את הערכים מהאריזה (ל-100 גרם) פעם אחת, והם יישמרו. בסריקה הבאה של אותו מוצר הוא יימצא מיד.</span>
          </li>
        </ul>

        <button type="button" onClick={onContinue} className="btn-primary mt-5 w-full py-3">
          הבנתי, פתח את המצלמה
        </button>
        <button type="button" onClick={onCancel} className="mt-2 w-full py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          ביטול
        </button>
      </div>
    </div>,
    document.body,
  );
}
