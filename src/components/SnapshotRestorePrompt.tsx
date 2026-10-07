import { useState } from 'react';
import { createPortal } from 'react-dom';
import { History, Loader2, RotateCcw, Undo2 } from 'lucide-react';
import type { Snapshot } from '../services/snapshotStore';
import { describeSnapshot, formatSnapshotDate } from '../utils/snapshotRestore';

interface SnapshotRestorePromptProps {
  snapshot: Snapshot;
  onRestore: () => Promise<void>;
  onDecline: () => void;
}

/** Shown when the app opens with no data but a recent automatic snapshot exists on the device. */
export default function SnapshotRestorePrompt({ snapshot, onRestore, onDecline }: SnapshotRestorePromptProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [failed, setFailed] = useState(false);

  async function restore() {
    setIsRestoring(true);
    setFailed(false);
    try {
      await onRestore();
    } catch {
      setFailed(true);
      setIsRestoring(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-prompt-title"
      className="fixed inset-0 z-[85] flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="glass-card neon-border flex w-full max-w-sm flex-col gap-4 p-6 text-center shadow-glow animate-slide-up">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-400/10 text-lime-600 dark:text-lime-400">
          <History className="h-6 w-6" />
        </span>
        <div>
          <h2 id="snapshot-prompt-title" className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
            מצאנו גיבוי אוטומטי של הנתונים שלך
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            נראה שהנתונים לא נמצאים במכשיר, אבל נשמר עותק מ-{formatSnapshotDate(snapshot.createdAt)}.
          </p>
          <p className="mt-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{snapshot.summary.name} · {describeSnapshot(snapshot)}</p>
        </div>
        {failed && <p className="text-xs font-semibold text-red-500">השחזור נכשל, נסו שוב.</p>}
        <button type="button" onClick={() => void restore()} disabled={isRestoring} className="btn-primary w-full py-3.5">
          {isRestoring ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
          שחזר את הנתונים
        </button>
        <button type="button" onClick={onDecline} disabled={isRestoring} className="btn-secondary w-full">
          התחל מאפס
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** After "reset and start over": one tap brings everything back. Goes away when the user continues with the setup. */
export function UndoResetBar({ onUndo }: { onUndo: () => Promise<void> }) {
  const [isBusy, setIsBusy] = useState(false);
  return createPortal(
    <div className="fixed inset-x-0 bottom-4 z-[85] flex justify-center px-4 animate-slide-up">
      <div className="glass-card neon-border flex w-full max-w-md items-center justify-between gap-3 px-4 py-3 shadow-glow">
        <p className="text-xs font-semibold leading-snug text-zinc-700 dark:text-zinc-300">הנתונים אופסו. שמרנו עותק, אפשר לשחזר אותו.</p>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            setIsBusy(true);
            void onUndo().finally(() => setIsBusy(false));
          }}
          className="btn-primary shrink-0 px-3 py-2 text-xs"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
          בטל איפוס
        </button>
      </div>
    </div>,
    document.body,
  );
}
