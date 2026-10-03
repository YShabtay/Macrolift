import { formatMacro } from '../utils/formatMacro';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Trash2, UtensilsCrossed, X } from 'lucide-react';
import type { FoodEntry } from '../types/fitness';
import { getEntryTitle, MEAL_LABELS, sumTotals } from '../utils/nutritionLog';
import EditMealModal from './EditMealModal';
import Toast from './Toast';

interface DailyMealsModalProps {
  entries: FoodEntry[];
  onUpdate: (id: string, updates: Partial<Omit<FoodEntry, 'id' | 'date' | 'meal'>>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const DELETE_CONFIRM_TIMEOUT_MS = 3000;

export default function DailyMealsModal({ entries, onUpdate, onDelete, onClose }: DailyMealsModalProps) {
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, []);

  const totals = sumTotals(entries);
  const sortedEntries = [...entries].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  function handleDeleteClick(id: string) {
    if (confirmingDeleteId === id) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingDeleteId(null);
      onDelete(id);
      setToastMessage('הארוחה הוסרה מהיומן');
      return;
    }
    setConfirmingDeleteId(id);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmingDeleteId(null), DELETE_CONFIRM_TIMEOUT_MS);
  }

  function handleSaveEdit(id: string, updates: Partial<Omit<FoodEntry, 'id' | 'date' | 'meal'>>) {
    onUpdate(id, updates);
    setToastMessage('הארוחה עודכנה בהצלחה ✓');
  }

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
        >
          <div
            className="glass-card neon-border flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden shadow-glow animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
                    <UtensilsCrossed className="h-4 w-4" />
                  </span>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">ארוחות היום</h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="סגירה"
                  className="text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <SummaryStat label="קלוריות" value={formatMacro(totals.calories)} valueClassName="text-lime-700 dark:text-lime-400" />
                <SummaryStat label="חלבון" value={`${formatMacro(totals.proteinG)}ג׳`} valueClassName="text-sky-700 dark:text-sky-400" />
                <SummaryStat label="פחמימה" value={`${formatMacro(totals.carbsG)}ג׳`} valueClassName="text-amber-700 dark:text-amber-400" />
                <SummaryStat label="שומן" value={`${formatMacro(totals.fatG)}ג׳`} valueClassName="text-yellow-700 dark:text-yellow-400" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {sortedEntries.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-600 dark:text-zinc-500">
                  עדיין לא נרשמו ארוחות היום.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {sortedEntries.map((entry) => (
                    <MealRow
                      key={entry.id}
                      entry={entry}
                      isConfirmingDelete={confirmingDeleteId === entry.id}
                      onEdit={() => setEditingEntry(entry)}
                      onDeleteClick={() => handleDeleteClick(entry.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {editingEntry && (
        <EditMealModal entry={editingEntry} onSave={handleSaveEdit} onClose={() => setEditingEntry(null)} />
      )}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </>
  );
}

function MealRow({
  entry,
  isConfirmingDelete,
  onEdit,
  onDeleteClick,
}: {
  entry: FoodEntry;
  isConfirmingDelete: boolean;
  onEdit: () => void;
  onDeleteClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 p-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{getEntryTitle(entry)}</p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500">
            {MEAL_LABELS[entry.meal]}
            {entry.time && ` · ${entry.time}`}
            {entry.weightGrams != null && ` · ${entry.weightGrams} גר׳`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`עריכת ${entry.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDeleteClick}
            aria-label={isConfirmingDelete ? `לאשר מחיקת ${entry.name}` : `מחיקת ${entry.name}`}
            className={`flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition ${
              isConfirmingDelete
                ? 'border-red-500/50 bg-red-500/10 text-red-500'
                : 'w-8 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-red-500/40 hover:text-red-400'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            {isConfirmingDelete && 'לאשר?'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <MiniStat value={entry.calories} valueClassName="text-lime-700 dark:text-lime-400" />
        <MiniStat value={`${formatMacro(entry.proteinG)}ג׳`} valueClassName="text-sky-700 dark:text-sky-400" />
        <MiniStat value={`${formatMacro(entry.carbsG)}ג׳`} valueClassName="text-amber-700 dark:text-amber-400" />
        <MiniStat value={`${formatMacro(entry.fatG)}ג׳`} valueClassName="text-yellow-700 dark:text-yellow-400" />
      </div>
    </div>
  );
}

function SummaryStat({ label, value, valueClassName }: { label: string; value: string | number; valueClassName: string }) {
  return (
    <div className="rounded-lg bg-white/60 dark:bg-zinc-900/60 px-1.5 py-2">
      <p className={`text-base font-bold ${valueClassName}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

function MiniStat({ value, valueClassName }: { value: string | number; valueClassName: string }) {
  return (
    <div className="rounded-md bg-white/60 dark:bg-zinc-900/60 py-1.5">
      <p className={`text-xs font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}
