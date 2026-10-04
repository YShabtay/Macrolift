import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Settings2, Sparkles, X } from 'lucide-react';
import type { TrainingDaysPerWeek, WorkoutSplitType } from '../types/fitness';
import type { ProgramRecommendation } from '../utils/programRecommendation';

interface ProgramOption {
  split: WorkoutSplitType;
  shortLabel: string;
  title: string;
  /** Selectable weekly frequencies for this program. */
  days: TrainingDaysPerWeek[];
  description: string;
}

const PROGRAMS: ProgramOption[] = [
  {
    split: 'fbw',
    shortLabel: 'FBW',
    title: 'גוף מלא (Full Body)',
    days: [3],
    description: 'כל אימון מכסה את כל הגוף - כל שריר מקבל גירוי 3 פעמים בשבוע. מתאים לזמן מוגבל ולמתחילים.',
  },
  {
    split: 'upper_lower',
    shortLabel: 'AB',
    title: 'פיצול AB (עליון / תחתון)',
    days: [4],
    description: 'ארבעה אימונים: שניים לפלג גוף עליון ושניים לתחתון, כך שכל שריר מקבל 2 גירויים שבועיים עם התאוששות מלאה.',
  },
  {
    split: 'ppl',
    shortLabel: 'PPL',
    title: 'דחיפה / משיכה / רגליים',
    days: [5, 6],
    description: 'חמישה או שישה אימונים בשבוע עם נפח גבוה לכל קבוצת שרירים - למתאמנים עם זמן וניסיון.',
  },
];

interface ProgramSwitcherModalProps {
  currentSplit: WorkoutSplitType;
  currentDays: TrainingDaysPerWeek;
  /** When set (after the user changed their weekly days), the matching program is highlighted as the recommended one. */
  recommendation?: ProgramRecommendation;
  /** True when the current plan was built by the user: switching replaces it, so the modal says so. */
  isCustomPlan?: boolean;
  /** Label for the dismiss button; defaults to plain cancel. */
  dismissLabel?: string;
  onApply: (split: WorkoutSplitType, days: TrainingDaysPerWeek) => void;
  onClose: () => void;
}

export default function ProgramSwitcherModal({
  currentSplit,
  currentDays,
  recommendation,
  isCustomPlan = false,
  dismissLabel = 'ביטול',
  onApply,
  onClose,
}: ProgramSwitcherModalProps) {
  const initial = recommendation ?? { split: currentSplit, days: currentDays };
  const [split, setSplit] = useState<WorkoutSplitType>(initial.split);
  const [days, setDays] = useState<TrainingDaysPerWeek>(initial.days);

  function selectProgram(option: ProgramOption) {
    setSplit(option.split);
    setDays(option.days.includes(days) ? days : option.days[0]);
  }

  const isUnchanged = split === currentSplit && days === currentDays;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="בחירת תוכנית אימון"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/75 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-b-none p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-glow animate-slide-up sm:rounded-b-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <Settings2 className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">{recommendation ? 'המלצה לתוכנית אימון' : 'שינוי תוכנית אימון'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isCustomPlan && (
          <p className="rounded-xl border border-orange-400/40 bg-orange-400/10 p-3 text-xs font-semibold leading-relaxed text-orange-700 dark:text-orange-300">
            התוכנית הנוכחית נבנתה על ידך. החלפת תוכנית תחליף אותה בתוכנית אוטומטית (אפשר לבנות אותה מחדש ממסך האימון).
          </p>
        )}

        {recommendation && (
          <div className="flex items-start gap-2.5 rounded-xl border border-lime-400/30 bg-lime-400/5 p-3.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lime-700 dark:text-lime-400" />
            <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">{recommendation.reason}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {PROGRAMS.map((option) => {
            const isSelected = split === option.split;
            const isRecommended = recommendation?.split === option.split;
            return (
              <div
                key={option.split}
                className={`rounded-xl border p-3.5 transition ${
                  isSelected ? 'border-lime-400/60 bg-lime-400/10' : 'border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60'
                }`}
              >
                <button type="button" onClick={() => selectProgram(option)} aria-pressed={isSelected} className="flex w-full items-start justify-between gap-3 text-right">
                  <span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
                        {option.shortLabel} · {option.title}
                      </span>
                      {isRecommended && (
                        <span className="rounded-md bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">מומלץ</span>
                      )}
                      {option.split === currentSplit && (
                        <span className="rounded-md border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                          נוכחית
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{option.description}</span>
                  </span>
                  {isSelected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-700 dark:text-lime-400" />}
                </button>

                {isSelected && option.days.length > 1 && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-500">ימי אימון בשבוע:</span>
                    {option.days.map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={days === d}
                        onClick={() => setDays(d)}
                        className={`h-8 min-w-8 rounded-lg border px-3 text-sm font-bold transition ${
                          days === d
                            ? 'border-lime-400/60 bg-lime-400/20 text-lime-700 dark:text-lime-400'
                            : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] leading-relaxed text-zinc-500">
          החלפה תבנה את האימונים מחדש (עם ההתאמות האישיות שלך), תפזר אותם בלוח השנה הקרוב ותחשב מחדש את יעד הקלוריות לתדירות החדשה. אימונים שכבר סימנת
          כהושלמו יישמרו.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onApply(split, days);
              onClose();
            }}
            disabled={isUnchanged && !recommendation}
            className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {recommendation ? 'אשר והחלף תוכנית' : 'החלף תוכנית'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
