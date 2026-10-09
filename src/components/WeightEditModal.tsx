import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import type { WeightLog } from '../types/fitness';
import DateField from './DateField';

const MIN_KG = 20;
const MAX_KG = 400;

interface WeightEditModalProps {
  entry: WeightLog;
  /** The other weigh-in dates, so moving this one onto a day that already has a weigh-in can be flagged. */
  takenDates: string[];
  today: string;
  /** Saves the edited weigh-in. The caller moves it when the date changed, and every average, trend and target reads the new value from the history. */
  onSave: (next: { date: string; weightKg: number }) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Edit one weigh-in: its date and weight. Everything else (weekly averages, the chart, the target weight, the checks) is derived from the history, so it follows. */
export default function WeightEditModal({ entry, takenDates, today, onSave, onDelete, onClose }: WeightEditModalProps) {
  const [date, setDate] = useState(entry.date);
  const [weight, setWeight] = useState(String(entry.weightKg));

  const weightValue = Number(weight);
  const isWeightValid = weight.trim() !== '' && Number.isFinite(weightValue) && weightValue >= MIN_KG && weightValue <= MAX_KG;
  const replacesAnother = date !== entry.date && takenDates.includes(date);
  const isUnchanged = date === entry.date && weightValue === entry.weightKg;
  const canSave = isWeightValid && !!date && date <= today && !isUnchanged;

  function save() {
    if (!canSave) return;
    onSave({ date, weightKg: Math.round(weightValue * 10) / 10 });
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="weight-edit-title"
        className="glass-card neon-border flex w-full max-w-sm flex-col gap-4 p-5 shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="weight-edit-title" className="font-bold text-zinc-900 dark:text-zinc-100">
            עריכת שקילה
          </h3>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">תאריך</label>
          <DateField
            value={date}
            max={today}
            onChange={setDate}
            ariaLabel="תאריך השקילה"
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">משקל (ק״ג)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            autoFocus
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            aria-label="משקל בק״ג"
            className={`w-full rounded-xl border bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 outline-none transition focus:ring-2 ${
              isWeightValid ? 'border-zinc-300 dark:border-zinc-700 focus:border-lime-400 focus:ring-lime-400/20' : 'border-orange-400/60 focus:border-orange-400 focus:ring-orange-400/20'
            }`}
          />
          {!isWeightValid && <p className="mt-1.5 text-[11px] text-orange-700 dark:text-orange-400">יש להזין משקל בין {MIN_KG} ל-{MAX_KG} ק״ג.</p>}
        </div>

        {replacesAnother && <p className="text-[11px] leading-relaxed text-orange-700 dark:text-orange-400">כבר יש שקילה בתאריך הזה. השמירה תחליף אותה.</p>}

        <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">הממוצע השבועי, הגרף, משקל היעד והבדיקות מתעדכנים לפי השקילה החדשה.</p>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={!canSave} className="btn-primary text-sm disabled:opacity-40">
            שמירה
          </button>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            ביטול
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn-secondary me-auto text-sm text-red-400 hover:border-red-500/40 hover:bg-red-500/5"
            aria-label="מחיקת השקילה"
          >
            <Trash2 className="h-4 w-4" />
            מחיקה
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
