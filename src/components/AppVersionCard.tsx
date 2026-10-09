import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { checkForAppUpdate, forceAppUpdate, getBuildId, type UpdateStatus } from '../utils/appUpdate';

/** Which version this device runs, a button that asks the server if there is a newer one, and a way to update that works even when the automatic route is stuck. */
export default function AppVersionCard() {
  const [status, setStatus] = useState<UpdateStatus | 'idle' | 'checking' | 'updating'>('idle');

  async function check() {
    setStatus('checking');
    setStatus(await checkForAppUpdate());
  }

  async function update() {
    setStatus('updating');
    await forceAppUpdate();
  }

  return (
    <div className="glass-card flex flex-col gap-2 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">גרסת האפליקציה</p>
          <p className="text-[11px] tabular-nums text-zinc-500">{getBuildId()}</p>
        </div>
        <button type="button" onClick={() => void check()} disabled={status === 'checking' || status === 'updating'} className="btn-secondary shrink-0 text-xs disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${status === 'checking' || status === 'updating' ? 'animate-spin' : ''}`} />
          בדיקת עדכון
        </button>
      </div>

      {status === 'current' && <p className="text-xs font-semibold text-lime-700 dark:text-lime-400">האפליקציה מעודכנת לגרסה האחרונה ✓</p>}
      {status === 'unknown' && (
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          לא הצלחתי לבדוק (אין חיבור, או שזו גרסת פיתוח). אם יש חיבור ואתה חושד שהגרסה ישנה, אפשר לאלץ עדכון.{' '}
          <button type="button" onClick={() => void update()} className="font-semibold underline">
            אלץ עדכון
          </button>
        </p>
      )}
      {status === 'available' && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">יש גרסה חדשה.</p>
          <button type="button" onClick={() => void update()} className="btn-primary text-xs">
            עדכן עכשיו
          </button>
        </div>
      )}
      {status === 'updating' && <p className="text-xs text-zinc-600 dark:text-zinc-400">מעדכן... האפליקציה תיטען מחדש. הנתונים שלך נשמרים.</p>}
      {(status === 'available' || status === 'idle') && <p className="text-[11px] leading-relaxed text-zinc-500">העדכון מחליף רק את קוד האפליקציה. הנתונים נשארים כמו שהם.</p>}
    </div>
  );
}
