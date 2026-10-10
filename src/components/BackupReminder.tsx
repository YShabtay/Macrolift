import { useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

interface BackupReminderProps {
  /** Days since the last backup, or null if there never was one. */
  daysSinceBackup: number | null;
  /** Runs the export; resolves true when a backup was actually made. */
  onBackup: () => Promise<boolean>;
  onLater: () => void;
}

/** A calm dashboard card asking for a backup, since the data lives only on this device. */
export default function BackupReminder({ daysSinceBackup, onBackup, onLater }: BackupReminderProps) {
  const [isBusy, setIsBusy] = useState(false);
  const isMobile = useIsMobile();

  async function handleBackup() {
    setIsBusy(true);
    try {
      await onBackup();
    } finally {
      setIsBusy(false);
    }
  }

  if (!isMobile) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-2xl border border-orange-400/40 bg-orange-400/10 p-3.5 animate-fade-in">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-400/20 text-orange-700 dark:text-orange-300">
            <Save className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">הגיע הזמן לגבות את הנתונים 💾</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
              {daysSinceBackup === null ? 'עוד לא גיבית.' : `הגיבוי האחרון היה לפני ${daysSinceBackup} ימים.`} המידע נשמר רק במכשיר הזה, וגיבוי לוקח כמה שניות.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void handleBackup()} disabled={isBusy} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-60">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            גבה עכשיו
          </button>
          <button type="button" onClick={onLater} className="btn-secondary px-4 py-2.5 text-sm">
            הזכר לי אחר כך
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="flex items-center gap-2.5 rounded-2xl border border-orange-400/40 bg-orange-400/10 p-2.5 animate-fade-in">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-400/20 text-orange-700 dark:text-orange-300">
        <Save className="h-4 w-4" />
      </span>
      <p className="min-w-0 flex-1 text-xs font-bold leading-snug text-zinc-900 dark:text-zinc-100">
        {daysSinceBackup === null ? 'עוד לא גיבית את הנתונים' : `הגיבוי האחרון לפני ${daysSinceBackup} ימים`}
        <span className="block font-normal text-zinc-600 dark:text-zinc-400">הנתונים נשמרים רק במכשיר הזה</span>
      </p>
      <button type="button" onClick={() => void handleBackup()} disabled={isBusy} className="btn-primary shrink-0 px-3 py-2 text-xs disabled:opacity-60">
        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        גבה
      </button>
      <button type="button" onClick={onLater} aria-label="הזכר לי אחר כך" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-orange-400/20 dark:text-zinc-400">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
