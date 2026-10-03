import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Rocket, Upload } from 'lucide-react';
import { restoreProfileFromBackup } from '../utils/localProfiles';
import RestoreResultModal, { type RestoreResult } from './RestoreResultModal';

interface StandaloneRestorePromptProps {
  /** A backup was restored and its profile is now the active one. */
  onRestored: (userId: string) => void;
  /** The user chose to set up a fresh profile (or dismissed the prompt). */
  onStartFresh: () => void;
}

/**
 * First launch of the installed home-screen app on a device with no data yet. On iPhone the installed app's storage is separate
 * from Safari's, so someone who already tracked in the browser would otherwise land on an empty app and think everything
 * vanished. This offers to load their backup file right away (or to start fresh).
 */
export default function StandaloneRestorePrompt({ onRestored, onStartFresh }: StandaloneRestorePromptProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [outcome, setOutcome] = useState<{ result: RestoreResult; userId: string | null } | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsRestoring(true);
    try {
      const restored = await restoreProfileFromBackup(await file.text());
      setOutcome(
        restored.ok
          ? { result: { kind: 'success', summary: restored.summary, skipped: restored.skipped }, userId: restored.userId }
          : { result: { kind: 'error', message: restored.error }, userId: null },
      );
    } catch {
      setOutcome({ result: { kind: 'error', message: 'לא ניתן היה לקרוא את הקובץ שנבחר' }, userId: null });
    } finally {
      setIsRestoring(false);
    }
  }

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="standalone-welcome-title"
        className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm animate-fade-in"
      >
        <div className="glass-card neon-border flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center shadow-glow animate-slide-up">
          <div>
            <h2 id="standalone-welcome-title" className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
              ברוך הבא לאפליקציית MacroLift! 📲
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">האם כבר השתמשת באפליקציה בדפדפן (Safari/Chrome)?</p>
          </div>

          <button type="button" onClick={() => inputRef.current?.click()} disabled={isRestoring} className="btn-primary w-full py-4 text-base">
            {isRestoring ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            {isRestoring ? 'טוען את הגיבוי...' : 'שחזר את הנתונים מקובץ הגיבוי 📥'}
          </button>
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />

          <button type="button" onClick={onStartFresh} disabled={isRestoring} className="btn-secondary w-full">
            <Rocket className="h-4 w-4" />
            אני משתמש חדש, התחל הגדרת פרופיל מאפס 🚀
          </button>
        </div>
      </div>

      {outcome && (
        <RestoreResultModal
          result={outcome.result}
          onClose={() => {
            const finished = outcome;
            setOutcome(null);
            if (finished.userId) onRestored(finished.userId);
          }}
        />
      )}
    </>,
    document.body,
  );
}
