import { createPortal } from 'react-dom';
import { AlertTriangle, Upload, X } from 'lucide-react';

interface ImportConfirmModalProps {
  /** Set when the file only holds weigh-ins: they are merged into the existing history instead of replacing everything. */
  weightsOnlyCount?: number;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ImportConfirmModal({ weightsOnlyCount, onConfirm, onClose }: ImportConfirmModalProps) {
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">לייבא נתונים מגיבוי?</h3>
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
          {weightsOnlyCount !== undefined ? (
            <>
              הקובץ מכיל <b>{weightsOnlyCount} שקילות</b>. הן ימוזגו להיסטוריית השקילות הקיימת: תאריך קיים יתעדכן, ותאריך חדש יתווסף.
              שאר הנתונים לא ישתנו.
            </>
          ) : (
            <>
              הנתונים שבקובץ הגיבוי (פרופיל, שקילות, יומן תזונה, תמונות ועוד) <b>יחליפו</b> את הנתונים התואמים במכשיר זה. נתונים שאינם בקובץ
              יישארו כפי שהם. פעולה זו אינה הפיכה.
            </>
          )}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 active:scale-95"
          >
            <Upload className="h-4 w-4" />
            {weightsOnlyCount !== undefined ? 'כן, מזג שקילות' : 'כן, ייבא והחלף'}
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
