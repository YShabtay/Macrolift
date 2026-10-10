import { useMemo, useState } from 'react';
import { Check, Flag, Pencil, X } from 'lucide-react';
import type { UserMetrics, WeightLog } from '../types/fitness';
import { getCurrentWeight, getWeightTargetProgress, validateWeightTarget, type WeightTargetProgress } from '../utils/weightTarget';
import { todayIso } from '../utils/weightCalculations';
import { useIsMobile } from '../hooks/useIsMobile';

interface WeightTargetCardProps {
  weightLogs: WeightLog[];
  metrics: UserMetrics;
  /** Sets (or, with null, clears) the target weight; the profile keeps the start weight and checks it against the goal. */
  onSetTarget: (targetKg: number | null) => void;
  /** Switches the goal to maintenance once the target is reached. */
  onSwitchToMaintain: () => void;
  /** 'banner': only when a target exists (dashboard). 'card': also offers to set one (progress tab). */
  variant: 'banner' | 'card';
}

const kg = (n: number) => n.toLocaleString('he-IL', { maximumFractionDigits: 1 });

function describeEta(eta: NonNullable<WeightTargetProgress['eta']>): string {
  const range = eta.maxWeeks === null ? `יותר מ-${eta.minWeeks} שבועות` : eta.minWeeks === eta.maxWeeks ? `כ-${eta.minWeeks} שבועות` : `כ-${eta.minWeeks} עד ${eta.maxWeeks} שבועות`;
  return eta.basis === 'measured' ? `בקצב של החודש האחרון: ${range}.` : `בקצב שהמטרה מתכננת: ${range}. ההערכה תתעדכן לפי השקילות שלך.`;
}

/** Progress toward a target body weight, always on the weekly average. Reaching it (two weeks in a row at the target) offers a switch to maintenance. */
export default function WeightTargetCard({ weightLogs, metrics, onSetTarget, onSwitchToMaintain, variant }: WeightTargetCardProps) {
  const today = todayIso();
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const progress = useMemo(() => getWeightTargetProgress({ metrics, weightLogs, today }), [metrics, weightLogs, today]);
  const currentKg = useMemo(() => getCurrentWeight(weightLogs, metrics.weightKg, today).kg, [weightLogs, metrics.weightKg, today]);

  const draftValue = draft.trim() === '' ? null : Number(draft);
  const check = draftValue === null ? null : validateWeightTarget({ targetKg: draftValue, currentKg, heightCm: metrics.heightCm, goal: metrics.goal });

  // On a phone's home screen it only appears when there is something to decide (target reached, switch to maintenance); the progress tab always shows it, and a computer shows it on the home screen too.
  if (variant === 'banner' && (isMobile ? !progress || progress.status !== 'reached' || metrics.goal === 'maintain' : !progress)) return null;

  function startEditing() {
    setDraft(progress ? String(progress.targetKg) : '');
    setIsEditing(true);
  }

  function save() {
    if (draftValue === null || !check?.ok) return;
    onSetTarget(draftValue);
    setIsEditing(false);
  }

  const form = isEditing && (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          aria-label="משקל יעד בק״ג"
          placeholder="למשל 72"
          className="w-28 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
        />
        <span className="text-xs text-zinc-600 dark:text-zinc-400">ק״ג</span>
        <button type="button" onClick={save} disabled={!check?.ok} className="btn-primary px-3 py-2 text-xs disabled:opacity-40">
          <Check className="h-4 w-4" />
          שמור
        </button>
        <button type="button" onClick={() => setIsEditing(false)} aria-label="ביטול" className="btn-secondary px-2.5 py-2">
          <X className="h-4 w-4" />
        </button>
      </div>
      {check?.error && <p className="text-[11px] leading-relaxed text-orange-700 dark:text-orange-400">{check.error}</p>}
      {check?.ok && check.warning && <p className="text-[11px] leading-relaxed text-orange-700 dark:text-orange-400">{check.warning}</p>}
      {progress && (
        <button type="button" onClick={() => { onSetTarget(null); setIsEditing(false); }} className="self-start text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 underline">
          הסר את היעד
        </button>
      )}
    </div>
  );

  if (!progress) {
    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">משקל יעד</h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          אפשר להגדיר משקל שאליו מכוונים ולראות כמה נשאר, וכמה זמן זה בערך ייקח. היעד נבדק על הממוצע השבועי, לא על שקילה בודדת.
        </p>
        {isEditing ? form : (
          <button type="button" onClick={startEditing} className="btn-secondary mt-3 text-xs">
            הגדרת משקל יעד
          </button>
        )}
      </div>
    );
  }

  const isMaintaining = metrics.goal === 'maintain';

  if (progress.status === 'reached') {
    return (
      <div className="glass-card neon-border p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{isMaintaining ? `במשקל היעד: ${kg(progress.targetKg)} ק״ג` : `הגעת ליעד: ${kg(progress.targetKg)} ק״ג`}</h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          {isMaintaining
            ? 'הממוצע השבועי נשאר ביעד, וזה בדיוק מה ששמירה אמורה להיראות. אם הוא יתרחק, בדיקת המגמה תציע תיקון.'
            : 'הממוצע השבועי עמד ביעד שבועיים ברצף. להמשיך באותו יעד קלוריות ימשיך להזיז את המשקל, ולכן כדאי לעבור לשמירה, או להגדיר יעד חדש.'}
        </p>
        {!isEditing && (
          <div className="mt-3 flex flex-wrap gap-2">
            {!isMaintaining && (
              <button type="button" onClick={onSwitchToMaintain} className="btn-primary text-xs">
                מעבר לשמירה
              </button>
            )}
            <button type="button" onClick={startEditing} className="btn-secondary text-xs">
              {isMaintaining ? 'שינוי יעד' : 'יעד חדש'}
            </button>
          </div>
        )}
        {form}
      </div>
    );
  }

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">משקל יעד: {kg(progress.targetKg)} ק״ג</h3>
        </div>
        {!isEditing && (
          <button type="button" onClick={startEditing} aria-label="עריכת משקל היעד" className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {kg(progress.currentKg)}
          <span className="font-medium text-zinc-500"> / {kg(progress.targetKg)} ק״ג</span>
        </p>
        <p className="text-xs font-bold tabular-nums text-lime-700 dark:text-lime-400">נשארו {kg(progress.remainingKg)} ק״ג</p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-lime-400 transition-all duration-500" style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        {progress.currentBasis === 'week-average' ? 'ממוצע 7 הימים האחרונים' : progress.currentBasis === 'latest' ? 'השקילה האחרונה (אין שקילות מהשבוע האחרון)' : 'משקל הפרופיל (עדיין אין שקילות)'}
      </p>

      {progress.trend === 'away' && (
        <p className="mt-3 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
          במשך החודש האחרון המשקל זז בכיוון ההפוך מהיעד. בדיקת המגמה בכרטיס שמתחת תציע אם כדאי לשנות את היעד הקלורי.
        </p>
      )}
      {progress.eta && <p className="mt-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">{describeEta(progress.eta)}</p>}
      {metrics.goal === 'gain_muscle' && progress.direction === 'gain' && (
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
          היעד הוא מספר על המשקל. בעלייה במסה חלק מהמשקל הוא שומן, ולכן כדאי לעקוב גם אחרי ההיקפים.
        </p>
      )}
      {form}
    </div>
  );
}
