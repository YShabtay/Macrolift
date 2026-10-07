import { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { snapshotStore, type Snapshot } from '../services/snapshotStore';
import { describeSnapshot, formatSnapshotDate, SNAPSHOT_REASON_LABELS } from '../utils/snapshotRestore';

interface AutoBackupCardProps {
  userId: string;
  /** Changes whenever the data changes, so a daily copy written in the background shows up. */
  refreshKey: unknown;
  onRestore: (snapshot: Snapshot) => Promise<boolean>;
}

/** Lists the automatic on-device copies and restores one on request (the current data is copied first, so a restore can be undone). */
export default function AutoBackupCard({ userId, refreshKey, onRestore }: AutoBackupCardProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void snapshotStore.list(userId).then((list) => {
      if (!cancelled) setSnapshots(list);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey, message]);

  async function restore(snapshot: Snapshot) {
    setBusyId(snapshot.id);
    const ok = await onRestore(snapshot);
    setBusyId(null);
    setConfirmId(null);
    setMessage(ok ? 'הנתונים שוחזרו' : 'השחזור נכשל, הנתונים הנוכחיים לא השתנו');
  }

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="mb-2 flex items-center gap-2">
        <History className="h-4 w-4 text-lime-700 dark:text-lime-400" />
        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">גיבויים אוטומטיים במכשיר</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
        האפליקציה שומרת לבד עותק מהנתונים פעם ביום (7 הימים האחרונים), וגם לפני איפוס או שחזור. הם מגנים מפני מחיקה בטעות או תקלה, אבל
        נשמרים באותו דפדפן, ולכן לא מחליפים גיבוי לקובץ: אם מנקים את כל נתוני האתר, הם נמחקים יחד עם האפליקציה. תמונות התקדמות נשמרות רק
        בעותקים שלפני איפוס או שחזור.
      </p>

      {snapshots === null ? null : snapshots.length === 0 ? (
        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">עדיין אין עותקים. הראשון ייווצר אחרי שתתעד משהו.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {snapshots.map((s) => (
            <li key={s.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    {formatSnapshotDate(s.createdAt)} <span className="text-[11px] font-semibold text-zinc-500">· {SNAPSHOT_REASON_LABELS[s.reason]}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-500">{describeSnapshot(s)}</p>
                </div>
                {confirmId !== s.id && (
                  <button type="button" onClick={() => setConfirmId(s.id)} disabled={busyId !== null} className="btn-secondary shrink-0 px-3 py-1.5 text-xs">
                    <RotateCcw className="h-3.5 w-3.5" />
                    שחזר
                  </button>
                )}
              </div>
              {confirmId === s.id && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                    הנתונים הנוכחיים יוחלפו בעותק הזה. לפני כן נשמר עותק שלהם, כך שאפשר לחזור אחורה.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void restore(s)} disabled={busyId !== null} className="btn-primary px-3 py-1.5 text-xs">
                      {busyId === s.id ? 'משחזר...' : 'אישור שחזור'}
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} disabled={busyId !== null} className="btn-secondary px-3 py-1.5 text-xs">
                      ביטול
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <p className="mt-3 text-xs font-semibold text-lime-700 dark:text-lime-400">{message}</p>}
    </div>
  );
}
