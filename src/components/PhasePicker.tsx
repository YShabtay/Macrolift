import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarRange, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { GoalPhase } from '../types/fitness';
import { PHASE_LABELS, describePhase, validatePhases, type PhaseStats } from '../utils/phases';
import { formatDateDisplay, todayIso } from '../utils/weightCalculations';
import DateField from './DateField';

export const ALL_PHASES = 'all';

interface PhasePickerProps {
  phases: GoalPhase[];
  /** The selected period's id, or `ALL_PHASES`. */
  selectedId: string;
  onSelect: (id: string) => void;
  /** The selected period's weight story (not shown for "all"). */
  stats: PhaseStats | null;
  /** Whether the starting photo from before the period is part of the photos shown. */
  hasBaselinePhoto: boolean;
  onEdit: () => void;
}

/** Chips to look at one period at a time (a cut, then a bulk...) or at everything together, with what happened to the weight in the period. */
export default function PhasePicker({ phases, selectedId, onSelect, stats, hasBaselinePhoto, onEdit }: PhasePickerProps) {
  const selected = phases.find((p) => p.id === selectedId);
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
      active
        ? 'border-lime-400/60 bg-lime-400/15 text-lime-700 dark:text-lime-400'
        : 'border-zinc-300 bg-white text-zinc-600 hover:border-lime-400/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
    }`;

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">תקופה</h2>
        </div>
        <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs font-semibold text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400">
          <Pencil className="h-3.5 w-3.5" />
          ערוך תקופות
        </button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="בחירת תקופה">
        <button type="button" role="radio" aria-checked={selectedId === ALL_PHASES} onClick={() => onSelect(ALL_PHASES)} className={chip(selectedId === ALL_PHASES)}>
          הכול
        </button>
        {[...phases].reverse().map((phase) => (
          <button key={phase.id} type="button" role="radio" aria-checked={selectedId === phase.id} onClick={() => onSelect(phase.id)} className={chip(selectedId === phase.id)}>
            {describePhase(phase)}
            {phase.endDate === undefined && ' (נוכחית)'}
          </button>
        ))}
      </div>

      {selected && stats && (
        <div className="rounded-xl border border-zinc-200 bg-white/50 p-3 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          <p className="font-bold text-zinc-900 dark:text-zinc-100">
            {PHASE_LABELS[selected.goal]}: {formatDateDisplay(selected.startDate)} - {selected.endDate ? formatDateDisplay(selected.endDate) : 'היום'}
          </p>
          {stats.startAverageKg !== null && stats.endAverageKg !== null ? (
            <p className="mt-0.5">
              ממוצע שבועי: {stats.startAverageKg} ק״ג בתחילת התקופה
              {stats.changeKg !== null && (
                <>
                  {' '}
                  ← {stats.endAverageKg} ק״ג ({stats.changeKg > 0 ? '+' : ''}
                  {stats.changeKg} ק״ג, {stats.weeks} שבועות)
                </>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-zinc-500">אין עדיין שקילות בתקופה הזו.</p>
          )}
          {hasBaselinePhoto && <p className="mt-0.5 text-zinc-500">בתמונות: כולל התמונה האחרונה מלפני התקופה, כנקודת פתיחה.</p>}
        </div>
      )}
    </div>
  );
}

const GOAL_OPTIONS = Object.entries(PHASE_LABELS) as [GoalPhase['goal'], string][];

/** Edit the periods: the goal of each, when it started and when it ended (no end date = the current one). */
export function PhasesEditorModal({ phases, onSave, onClose }: { phases: GoalPhase[]; onSave: (phases: GoalPhase[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<GoalPhase[]>(() => phases.map((p) => ({ ...p })));
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();

  function update(id: string, patch: Partial<GoalPhase>) {
    setDraft((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setError(null);
  }

  function addPhase() {
    const last = [...draft].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)).pop();
    setDraft((list) => [...list, { id: `phase-${crypto.randomUUID()}`, goal: 'maintain', startDate: last?.endDate ?? today }]);
    setError(null);
  }

  function handleSave() {
    const problem = validatePhases(draft);
    if (problem) {
      setError(problem);
      return;
    }
    onSave([...draft].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)));
    onClose();
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="עריכת תקופות" dir="rtl" onClick={onClose} className="fixed inset-0 z-[85] flex items-end justify-center bg-zinc-950/80 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="glass-card neon-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-b-none shadow-glow animate-slide-up sm:rounded-b-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100">עריכת תקופות</h3>
          <button type="button" onClick={onClose} aria-label="סגירה" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            כל תקופה היא מטרה אחת (למשל חיטוב ואחריו מסה). כשאתה משנה מטרה בפרופיל, האפליקציה סוגרת את התקופה ופותחת חדשה. כאן אפשר לתקן תאריכים או להוסיף תקופה שהייתה לפני כן. התקופה הנוכחית נשארת בלי תאריך סיום.
          </p>
          <div className="flex flex-col gap-3">
            {[...draft]
              .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
              .map((phase) => (
                <div key={phase.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <select
                      value={phase.goal}
                      onChange={(e) => update(phase.id, { goal: e.target.value as GoalPhase['goal'] })}
                      aria-label="מטרה"
                      className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-bold text-zinc-900 outline-none focus:border-lime-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      {GOAL_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {draft.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDraft((list) => list.filter((p) => p.id !== phase.id))}
                        aria-label="מחיקת התקופה"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-500">התחלה</p>
                      <DateField value={phase.startDate} max={today} onChange={(value) => update(phase.id, { startDate: value })} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                    </div>
                    <div>
                      <p className="mb-1 flex items-center justify-between text-[11px] font-semibold text-zinc-600 dark:text-zinc-500">
                        <span>סיום</span>
                        {phase.endDate !== undefined && (
                          <button type="button" onClick={() => update(phase.id, { endDate: undefined })} className="font-semibold text-lime-700 underline-offset-2 hover:underline dark:text-lime-400">
                            נוכחית
                          </button>
                        )}
                      </p>
                      {phase.endDate !== undefined ? (
                        <DateField value={phase.endDate} max={today} onChange={(value) => update(phase.id, { endDate: value })} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => update(phase.id, { endDate: today })}
                          className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                        >
                          התקופה הנוכחית. לחץ כדי לסיים
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <button type="button" onClick={addPhase} className="btn-secondary mt-3 w-full">
            <Plus className="h-4 w-4" />
            הוסף תקופה
          </button>
          {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
          <button type="button" onClick={handleSave} className="btn-primary flex-1">
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
