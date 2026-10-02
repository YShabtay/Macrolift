import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Footprints, Target, X } from 'lucide-react';
import { MAX_STEPS_PER_DAY } from '../utils/stepsCalculations';

function parseCount(text: string, min: number): number | null {
  const n = Number(text.replace(/,/g, ''));
  return text.trim() !== '' && Number.isFinite(n) && n >= min && n <= MAX_STEPS_PER_DAY ? Math.round(n) : null;
}

function ModalShell({ title, icon: Icon, onClose, children }: { title: string; icon: typeof Footprints; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="glass-card neon-border flex w-full max-w-sm flex-col gap-4 p-5 shadow-glow animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition hover:border-lime-400/60 hover:text-lime-700 dark:hover:text-lime-400 active:scale-95"
    >
      {label}
    </button>
  );
}

interface QuickStepsModalProps {
  currentSteps: number;
  onSave: (steps: number) => void;
  onClose: () => void;
}

/** Quick manual log of today's steps (typically copied from Apple Health / Google Fit). */
export function QuickStepsModal({ currentSteps, onSave, onClose }: QuickStepsModalProps) {
  const [value, setValue] = useState(currentSteps > 0 ? String(currentSteps) : '');
  const parsed = parseCount(value, 0);
  const typed = Number(value.replace(/,/g, '')) || 0;
  const isInvalid = value.trim() !== '' && parsed === null;

  return (
    <ModalShell title="עדכון צעדים להיום" icon={Footprints} onClose={onClose}>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">הזן את מספר הצעדים מ-Apple Health</label>
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && parsed !== null && onSave(parsed)}
          placeholder="0"
          aria-label="מספר צעדים"
          className="w-full rounded-xl border-2 border-lime-400/50 bg-white dark:bg-zinc-900 px-4 py-4 text-center text-3xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
        />
        {isInvalid && <p className="mt-1.5 text-[11px] font-medium text-red-400">הזינו מספר בין 0 ל-{MAX_STEPS_PER_DAY.toLocaleString()}</p>}
      </div>

      <div className="grid grid-cols-4 gap-2" dir="ltr">
        <Chip label="+2,000" onClick={() => setValue(String(Math.min(typed + 2000, MAX_STEPS_PER_DAY)))} />
        <Chip label="+5,000" onClick={() => setValue(String(Math.min(typed + 5000, MAX_STEPS_PER_DAY)))} />
        <Chip label="8,000" onClick={() => setValue('8000')} />
        <Chip label="10,000" onClick={() => setValue('10000')} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => parsed !== null && onSave(parsed)} disabled={parsed === null} className="btn-primary flex-1 disabled:opacity-40">
          שמירה
        </button>
        <button type="button" onClick={onClose} className="btn-secondary">
          ביטול
        </button>
      </div>
    </ModalShell>
  );
}

interface StepGoalModalProps {
  goal: number;
  onSave: (goal: number) => void;
  onClose: () => void;
}

export function StepGoalModal({ goal, onSave, onClose }: StepGoalModalProps) {
  const [value, setValue] = useState(String(goal));
  const parsed = parseCount(value, 1000);

  return (
    <ModalShell title="יעד צעדים יומי" icon={Target} onClose={onClose}>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">כמה צעדים ביום תרצו להגיע?</label>
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && parsed !== null && onSave(parsed)}
          aria-label="יעד צעדים יומי"
          className="w-full rounded-xl border-2 border-lime-400/50 bg-white dark:bg-zinc-900 px-4 py-3 text-center text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
        />
        {parsed === null && <p className="mt-1.5 text-[11px] font-medium text-red-400">יעד תקין: בין 1,000 ל-{MAX_STEPS_PER_DAY.toLocaleString()} צעדים</p>}
      </div>
      <div className="grid grid-cols-4 gap-2" dir="ltr">
        {[6000, 8000, 10000, 12000].map((g) => (
          <Chip key={g} label={g.toLocaleString()} onClick={() => setValue(String(g))} />
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => parsed !== null && onSave(parsed)} disabled={parsed === null} className="btn-primary flex-1 disabled:opacity-40">
          שמירת יעד
        </button>
        <button type="button" onClick={onClose} className="btn-secondary">
          ביטול
        </button>
      </div>
    </ModalShell>
  );
}
