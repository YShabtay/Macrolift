import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { describeRestore, type RestoreSummary } from '../utils/backupValidation';

export type RestoreResult =
  | { kind: 'success'; summary: RestoreSummary; skipped: number }
  | { kind: 'error'; message: string };

interface RestoreResultModalProps {
  result: RestoreResult;
  onClose: () => void;
}

/**
 * Centered confirmation after choosing a backup file: what was restored on success, or a plain
 * explanation of what's wrong with the file on failure. The data and charts are already updated
 * behind it by the time it appears, so closing it just reveals the refreshed screen.
 */
export default function RestoreResultModal({ result, onClose }: RestoreResultModalProps) {
  const isSuccess = result.kind === 'success';
  const lines = isSuccess ? describeRestore(result.summary) : [];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[85] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-full ${
            isSuccess ? 'bg-lime-400/15 text-lime-700 dark:text-lime-400' : 'bg-red-500/10 text-red-500'
          }`}
        >
          {isSuccess ? <CheckCircle2 className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
        </span>

        <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
          {isSuccess ? 'הנתונים שוחזרו בהצלחה! 🎉' : 'לא ניתן לשחזר את הקובץ'}
        </h3>

        {isSuccess ? (
          <>
            {lines.length > 0 && (
              <ul className="flex w-full flex-col gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3 text-right">
                {lines.map((line) => (
                  <li key={line} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />
                    {line}
                  </li>
                ))}
              </ul>
            )}
            {result.skipped > 0 && (
              <p className="text-xs text-orange-700 dark:text-orange-400">{result.skipped} רשומות לא תקינות בקובץ דולגו.</p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{result.message}</p>
            <p className="text-xs leading-relaxed text-zinc-500">
              הנתונים הקיימים במכשיר לא שונו. ודאו שזהו קובץ גיבוי של MacroLift שהורד מהאפליקציה.
            </p>
          </>
        )}

        <button type="button" onClick={onClose} className="btn-primary w-full">
          {isSuccess ? 'מצוין, המשך' : 'הבנתי'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
