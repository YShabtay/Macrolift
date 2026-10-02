import { createPortal } from 'react-dom';
import { Footprints, Scale, Sparkles, TrendingDown, X } from 'lucide-react';
import type { RebalanceOptions, WeeklyEnergyBalance } from '../utils/weeklyBalance';

export type RebalanceChoice =
  | { kind: 'taper'; reductionKcal: number; fromDate: string }
  | { kind: 'steps'; boost: number; fromDate: string }
  | { kind: 'keep' };

interface RebalanceModalProps {
  options: RebalanceOptions;
  balance: WeeklyEnergyBalance;
  /** The user's own daily step goal (without any rebalance boost). */
  baseStepGoal: number;
  onChoose: (choice: RebalanceChoice) => void;
  onClose: () => void;
}

/** Calm, evidence-framed ways to deal with a day over target, based on the weekly average rather than the single day. */
export default function RebalanceModal({ options, balance, baseStepGoal, onChoose, onClose }: RebalanceModalProps) {
  const { taper, steps, daysRemaining, excessKcal, fatEquivalentG } = options;

  function choose(choice: RebalanceChoice) {
    onChoose(choice);
    onClose();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="איזון שבועי חכם"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/75 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-b-none p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-glow animate-slide-up sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <Scale className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">איזון שבועי חכם ⚖️</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-xl border border-lime-400/30 bg-lime-400/5 p-3.5">
          <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed text-zinc-800 dark:text-zinc-200">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lime-700 dark:text-lime-400" />
            חריגה נקודתית היא חלק טבעי מהחיים. הגוף מגיב לממוצע השבועי ולא ליום בודד!
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            מאזן השבוע עד כה ({balance.daysCounted === 1 ? 'יום אחד שתועד' : `${balance.daysCounted} ימים שתועדו`}): נצרכו {balance.eatenKcal.toLocaleString()} מתוך{' '}
            {balance.targetKcal.toLocaleString()} קק״ל
            {balance.balanceKcal > 0 ? ` (${balance.balanceKcal.toLocaleString()}+ מעל היעד המצטבר)` : ' - בסך הכל אתם בתוך היעד המצטבר'}.
          </p>
        </div>

        {/* Option 1: gentle taper */}
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <TrendingDown className="h-4 w-4 text-lime-700 dark:text-lime-400" />
            פיזור עדין על שאר השבוע
          </p>
          {taper.available ? (
            <>
              <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                הפחתה קלה של {excessKcal} ÷ {daysRemaining} = <b>{taper.perDayKcal} קק״ל</b> {daysRemaining === 1 ? 'מהיעד של מחר (סוף השבוע)' : 'בכל יום עד סוף השבוע'} ({daysRemaining === 1 ? 'נותר יום אחד' : `נותרו ${daysRemaining} ימים`}). היעד חוזר לרגיל בתחילת השבוע הבא.
                {taper.capped && ' ההפחתה הוגבלה כדי לשמור על יעד בטוח, ולכן החריגה תאוזן חלקית.'}
              </p>
              <button
                type="button"
                onClick={() => choose({ kind: 'taper', reductionKcal: taper.perDayKcal, fromDate: taper.fromDate })}
                className="btn-primary text-sm"
              >
                קזז {taper.perDayKcal} קק״ל ליום עד סוף השבוע ✓
              </button>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">השבוע מסתיים היום, ולכן אין ימים לפזר עליהם. אפשר לאזן בתנועה או להמשיך כרגיל.</p>
          )}
        </div>

        {/* Option 2: steps */}
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <Footprints className="h-4 w-4 text-lime-700 dark:text-lime-400" />
            איזון תנועתי
          </p>
          <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            הוסיפו כ-<b>{steps.perDay.toLocaleString()} צעדים</b>{' '}
            {steps.days > 1 ? 'ביום, מהיום ועד סוף השבוע' : 'היום'} (כ-{steps.minutes} דקות הליכה מתונה), לפי הערכה של כ-40 קק״ל
            ל-1,000 צעדים.
            {steps.capped && ' הוגבל לתוספת סבירה ליום - האיזון יהיה חלקי.'}
          </p>
          <button type="button" onClick={() => choose({ kind: 'steps', boost: steps.perDay, fromDate: steps.fromDate })} className="btn-secondary text-sm">
            העלה את יעד הצעדים היומי ל-{(baseStepGoal + steps.perDay).toLocaleString()} 👟
          </button>
        </div>

        {/* Option 3: keep going */}
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">המשך כרגיל</p>
          <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            החריגה שווה ערך אנרגטי לכ-{fatEquivalentG} גרם שומן בלבד. אין צורך בשינוי, פשוט חזרו ליעד הרגיל מחר.
          </p>
          <button type="button" onClick={() => choose({ kind: 'keep' })} className="btn-secondary text-sm">
            השאר הכל כרגיל 👍
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
