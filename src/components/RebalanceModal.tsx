import { createPortal } from 'react-dom';
import { Footprints, Scale, Sparkles, TrendingDown, X } from 'lucide-react';
import type { RebalanceOptions, WeeklyEnergyBalance } from '../utils/weeklyBalance';

export type RebalanceChoice =
  | { kind: 'taper'; reductionKcal: number; fromDate: string }
  | { kind: 'steps'; boost: number; days: number; fromDate: string; toDate?: string }
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
  const { taper, stepsOneDay, stepsSpread, daysRemaining, excessKcal, fatEquivalentG, totalStepsToBurn, extraStepsWalkedToday, extraStepsEarlier, earlierWasYesterday, netExcessKcal, netStepsNeeded } = options;
  const isFullyCovered = netStepsNeeded === 0;
  const creditedKcal = excessKcal - netExcessKcal;

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

        {extraStepsEarlier > 0 && (
          <div className="rounded-xl border border-lime-400/30 bg-lime-400/5 p-3.5 text-sm font-semibold leading-relaxed text-zinc-800 dark:text-zinc-200">
            🎉 עודכנו {extraStepsEarlier.toLocaleString()} צעדי בונוס {earlierWasYesterday ? 'מאתמול' : 'מהימים הקודמים השבוע'} שקוזזו מהחריגה!
          </div>
        )}
        {extraStepsWalkedToday - extraStepsEarlier > 0 && (
          <div
            className={`rounded-xl border p-3.5 text-sm font-semibold leading-relaxed ${
              isFullyCovered
                ? 'border-lime-400/50 bg-lime-400/15 text-lime-800 dark:text-lime-300'
                : 'border-lime-400/30 bg-lime-400/5 text-zinc-800 dark:text-zinc-200'
            }`}
          >
            {isFullyCovered
              ? '🏆 צעדי הבונוס שהלכת כבר כיסו לחלוטין את החריגה הקלורית! אין צורך בתוספת צעדים למחר.'
              : `🎉 הלכת היום ${(extraStepsWalkedToday - extraStepsEarlier).toLocaleString()} צעדים מעל היעד! קיזזנו אותם מחוב הפיצוי.`}
          </div>
        )}
        {extraStepsEarlier > 0 && extraStepsWalkedToday - extraStepsEarlier === 0 && isFullyCovered && (
          <div className="rounded-xl border border-lime-400/50 bg-lime-400/15 p-3.5 text-sm font-semibold leading-relaxed text-lime-800 dark:text-lime-300">
            🏆 צעדי הבונוס כבר כיסו לחלוטין את החריגה הקלורית! אין צורך בתוספת צעדים למחר.
          </div>
        )}

        {/* Option 1: gentle taper */}
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <TrendingDown className="h-4 w-4 text-lime-700 dark:text-lime-400" />
            קיזוז קלורי עדין בשאר השבוע
          </p>
          {taper.available ? (
            <>
              <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                {creditedKcal > 0 ? `החריגה של ${excessKcal} קק״ל קוזזה בכ-${creditedKcal} קק״ל מהצעדים שכבר הלכת, ונותרו ${netExcessKcal} קק״ל` : `החריגה החד-פעמית של ${excessKcal} קק״ל`}{' '}
                {daysRemaining === 1 ? 'לפיזור על היום שנותר בשבוע' : `מתחלקת על פני ${daysRemaining} הימים שנותרו בשבוע`}.{' '}
                {daysRemaining === 1 ? (
                  <>
                    הפחתה של <b>{taper.perDayKcal} קק״ל</b> מהיעד של מחר (היום האחרון בשבוע).
                  </>
                ) : (
                  <>
                    הפחתה מתונה של <b>{taper.perDayKcal} קק״ל ליום</b> ב-{daysRemaining} הימים שנותרו בשבוע.
                  </>
                )}{' '}
                היעד חוזר לרגיל ביום ראשון.
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
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
              {isFullyCovered ? 'הצעדים שהלכת היום כבר כיסו את החריגה - אין צורך בקיזוז קלורי.' : 'השבוע מסתיים היום, ולכן אין ימים לפזר עליהם. אפשר לאזן בתנועה או להמשיך כרגיל.'}
            </p>
          )}
        </div>

        {/* Option 2: steps (NEAT) - one day, or spread */}
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <Footprints className="h-4 w-4 text-lime-700 dark:text-lime-400" />
            השלמת תנועה (צעדים)
          </p>
          <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            {excessKcal} קק״ל שווים לכ-{Math.round((excessKcal / 40) * 1000).toLocaleString()} צעדים בסך הכל (כ-40 קק״ל ל-1,000 צעדים)
            {extraStepsWalkedToday > 0 && !isFullyCovered && (
              <>
                {' '}
                ואחרי הקיזוז נותרו <b>{totalStepsToBurn.toLocaleString()}</b>
              </>
            )}
            .
          </p>
          {isFullyCovered ? (
            <button type="button" onClick={() => choose({ kind: 'keep' })} className="btn-primary text-sm">
              השאר יעד רגיל למחר ✓
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => choose({ kind: 'steps', boost: stepsOneDay.storedBoost, days: 1, fromDate: stepsOneDay.date, toDate: stepsOneDay.date })}
                className="btn-secondary flex-col gap-0.5 py-2.5 text-sm"
              >
                <span>
                  הוסף {stepsOneDay.steps.toLocaleString()} צעדים {stepsOneDay.isToday ? 'היום' : 'למחר'} בלבד (יעד מעודכן:{' '}
                  {(baseStepGoal + stepsOneDay.goalIncrease).toLocaleString()}) 👟
                </span>
                <span className="text-[11px] font-normal text-zinc-600 dark:text-zinc-400">
                  הליכה מתונה חד-פעמית, כ-{stepsOneDay.minutes} דקות{stepsOneDay.capped && ' - הוגבל לתוספת סבירה'}
                </span>
              </button>
              {stepsSpread.available && (
                <button
                  type="button"
                  onClick={() => choose({ kind: 'steps', boost: stepsSpread.storedPerDay, days: stepsSpread.days, fromDate: stepsSpread.fromDate })}
                  className="btn-secondary flex-col gap-0.5 py-2.5 text-sm"
                >
                  <span>פיזור: יעד צעדים {(baseStepGoal + stepsSpread.perDay).toLocaleString()} בכל יום 👟</span>
                  <span className="text-[11px] font-normal text-zinc-600 dark:text-zinc-400">
                    הוסף {stepsSpread.perDay.toLocaleString()} צעדים בכל יום עד סוף השבוע ({stepsSpread.days} ימים, כ-{stepsSpread.minutes} דקות ביום)
                    {stepsSpread.capped && ' - הוגבל, האיזון יהיה חלקי'}
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Option 3: keep going */}
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">המשך כרגיל</p>
          <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            {excessKcal <= 300 ? `חריגה של ${excessKcal} קק״ל היא זניחה (` : `חריגה של ${excessKcal} קק״ל קטנה ביחס לשבוע שלם (`}כ-{fatEquivalentG} גרם שומן
            בלבד). הגוף מאזן זאת טבעית, אין צורך בשינוי - פשוט חזרו ליעד הרגיל מחר.
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
