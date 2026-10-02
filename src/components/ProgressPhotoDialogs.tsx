import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Trash2, X } from 'lucide-react';
import type { ProgressPhoto } from '../types/fitness';
import { formatDateDisplay, todayIso } from '../utils/weightCalculations';
import DateField from './DateField';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG, parseWeightInput } from '../utils/weightInput';

export function ConfirmDeletePhotoModal({ photo, onConfirm, onClose }: { photo: ProgressPhoto; onConfirm: () => void; onClose: () => void }) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex w-full max-w-sm flex-col gap-4 p-5 shadow-glow animate-slide-up sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
            <Trash2 className="h-5 w-5" />
          </span>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">האם למחוק תמונת התקדמות זו?</h3>
        </div>
        <div className="flex items-center gap-3">
          <img src={photo.photoUrl} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            התמונה מתאריך <b>{formatDateDisplay(photo.date)}</b> תימחק לצמיתות. שקילות שנרשמו באותו תאריך לא יושפעו.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
            כן, מחק
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            ביטול
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface EditPhotoModalProps {
  photo: ProgressPhoto;
  /** The weight currently shown for this photo (the weigh-in on its date, else the photo's own snapshot), used as the starting value. */
  currentWeightKg: number | undefined;
  onSave: (changes: { date: string; weightKg: number | undefined; weightEdited: boolean }) => void;
  onClose: () => void;
}

export function EditPhotoModal({ photo, currentWeightKg, onSave, onClose }: EditPhotoModalProps) {
  const today = todayIso();
  const initialWeight = currentWeightKg !== undefined ? String(currentWeightKg) : '';
  const [date, setDate] = useState(photo.date);
  const [weight, setWeight] = useState(initialWeight);

  const parsedWeight = parseWeightInput(weight);
  const weightInvalid = weight.trim() !== '' && parsedWeight === null;
  const canSave = date !== '' && date <= today && !weightInvalid;

  function handleSave() {
    if (!canSave) return;
    onSave({ date, weightKg: parsedWeight ?? undefined, weightEdited: weight.trim() !== initialWeight.trim() });
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex w-full max-w-sm flex-col gap-4 p-5 shadow-glow animate-slide-up sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <Pencil className="h-5 w-5" />
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">עריכת תאריך ומשקל</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">תאריך התמונה</label>
          <DateField
            value={date}
            max={today}
            onChange={setDate}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">משקל באותו יום (ק״ג)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="למשל 72.4"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
          />
          {weightInvalid ? (
            <p className="mt-1 text-[11px] font-medium text-red-400">הזינו משקל בין {MIN_WEIGHT_KG} ל-{MAX_WEIGHT_KG} ק״ג</p>
          ) : (
            <p className="mt-1 text-[11px] text-zinc-500">שינוי המשקל מעדכן גם את יומן השקילות והגרף.</p>
          )}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={handleSave} disabled={!canSave} className="btn-primary flex-1 disabled:opacity-40">
            שמירה
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            ביטול
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
