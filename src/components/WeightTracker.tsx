import DateField from './DateField';
import { useMemo, useState } from 'react';
import { Calendar, ChevronDown, Pencil, Scale, Trash2, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import type { WeightLog } from '../types/fitness';
import {
  buildWeeklySummaries,
  formatDateDisplay,
  getLogForDate,
  todayIso,
  type WeeklyWeightSummary,
} from '../utils/weightCalculations';
import type { BulkWeightEntry } from '../utils/bulkWeightParser';
import WeightTrendChart from './WeightTrendChart';
import BulkWeightModal from './BulkWeightModal';
import WeightEditModal from './WeightEditModal';
import Toast from './Toast';

interface WeightTrackerProps {
  logs: WeightLog[];
  onSave: (date: string, weightKg: number, notes?: string) => void;
  /** Only used in the full (non-compact) history view. */
  onDelete?: (id: string) => void;
  /** Only used in the full (non-compact) history view. */
  onBulkImport?: (entries: BulkWeightEntry[]) => void;
  /** Compact renders just the dashboard "morning weigh-in" card. */
  compact?: boolean;
}

export default function WeightTracker({
  logs,
  onSave,
  onDelete = () => {},
  onBulkImport = () => {},
  compact = false,
}: WeightTrackerProps) {
  const today = todayIso();
  const todayLog = getLogForDate(logs, today);
  const summaries = useMemo(() => buildWeeklySummaries(logs), [logs]);
  const currentWeek = summaries[summaries.length - 1] ?? null;

  if (compact) {
    return <CompactCard todayLog={todayLog} currentWeek={currentWeek} onSave={onSave} today={today} />;
  }

  return (
    <FullTracker
      logs={logs}
      summaries={summaries}
      onSave={onSave}
      onDelete={onDelete}
      onBulkImport={onBulkImport}
      today={today}
    />
  );
}

// ---------------------------------------------------------------------------
// Compact dashboard card
// ---------------------------------------------------------------------------

function CompactCard({
  todayLog,
  currentWeek,
  onSave,
  today,
}: {
  todayLog: WeightLog | undefined;
  currentWeek: WeeklyWeightSummary | null;
  onSave: (date: string, weightKg: number, notes?: string) => void;
  today: string;
}) {
  const [weight, setWeight] = useState('');

  function handleSave() {
    const num = Number(weight);
    if (!weight.trim() || Number.isNaN(num) || num <= 0) return;
    onSave(today, num);
    setWeight('');
  }

  return (
    <div className="glass-card flex flex-col p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Scale className="h-5 w-5 text-lime-700 dark:text-lime-400" />
        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">שקילת בוקר</h2>
      </div>

      {todayLog ? (
        <div className="flex flex-1 flex-col justify-center gap-3">
          <div>
            <p className="text-xs text-zinc-600 dark:text-zinc-500">משקל היום</p>
            <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
              {todayLog.weightKg}
              <span className="mr-1 text-sm font-normal text-zinc-600 dark:text-zinc-500">ק״ג</span>
            </p>
          </div>
          {currentWeek && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-500">ממוצע שבועי</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-lime-700 dark:text-lime-400">{currentWeek.averageKg} ק״ג</p>
                <TrendBadge delta={currentWeek.deltaFromPreviousWeek} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-3">
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
            שקילת בוקר (בצום ולאחר התרוקנות נוזלים) נותנת את התמונה המדויקת ביותר
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="משקל היום"
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
              />
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-zinc-600 dark:text-zinc-500">
                ק״ג
              </span>
            </div>
            <button type="button" onClick={handleSave} className="btn-primary shrink-0 px-5">
              שמירה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-500">ללא שינוי</span>;
  }
  const isDown = delta < 0;
  const Icon = isDown ? TrendingDown : TrendingUp;
  return (
    <span
      className={`flex items-center gap-1 text-xs font-semibold ${isDown ? 'text-lime-700 dark:text-lime-400' : 'text-orange-700 dark:text-orange-400'}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {isDown ? '' : '+'}
      {delta} ק״ג
    </span>
  );
}

// ---------------------------------------------------------------------------
// Full tracker (Progress tab)
// ---------------------------------------------------------------------------

function FullTracker({
  logs,
  summaries,
  onSave,
  onDelete,
  onBulkImport,
  today,
}: {
  logs: WeightLog[];
  summaries: WeeklyWeightSummary[];
  onSave: (date: string, weightKg: number, notes?: string) => void;
  onDelete: (id: string) => void;
  onBulkImport: (entries: BulkWeightEntry[]) => void;
  today: string;
}) {
  const [formDate, setFormDate] = useState(today);
  const [formWeight, setFormWeight] = useState(() => {
    const existing = getLogForDate(logs, today);
    return existing ? String(existing.weightKg) : '';
  });
  const [expandedWeek, setExpandedWeek] = useState<string | null>(summaries[summaries.length - 1]?.weekStart ?? null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<WeightLog | null>(null);

  // logs for the selected date can change from outside this form (bulk import, another
  // device) - keep the weight field in sync without an effect, same pattern as Settings.tsx.
  const logForFormDate = getLogForDate(logs, formDate);
  const formDateWeightKey = `${formDate}:${logForFormDate?.weightKg ?? ''}`;
  const [syncedWeightKey, setSyncedWeightKey] = useState(formDateWeightKey);
  if (formDateWeightKey !== syncedWeightKey) {
    setSyncedWeightKey(formDateWeightKey);
    setFormWeight(logForFormDate ? String(logForFormDate.weightKg) : '');
  }

  const currentWeek = summaries[summaries.length - 1] ?? null;
  const recentWeeks = summaries.slice(-8);

  function handleDateChange(date: string) {
    setFormDate(date);
    const existing = getLogForDate(logs, date);
    setFormWeight(existing ? String(existing.weightKg) : '');
  }

  function handleSave() {
    const num = Number(formWeight);
    if (!formDate || Number.isNaN(num) || num <= 0) return;
    onSave(formDate, num);
  }

  function saveEditedEntry(entry: WeightLog, next: { date: string; weightKg: number }) {
    // Moving a weigh-in to another day: drop the old record first, then save under the new date (a save on an existing date replaces that day's weigh-in).
    if (next.date !== entry.date) onDelete(entry.id);
    onSave(next.date, next.weightKg, entry.notes);
    setEditingEntry(null);
    setToastMessage('השקילה עודכנה');
  }

  function handleBulkImportConfirm(entries: BulkWeightEntry[]) {
    onBulkImport(entries);
    setIsBulkModalOpen(false);
    setToastMessage(`${entries.length} שקילות יובאו בהצלחה!`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div data-tour="weight-entry" className="glass-card p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Scale className="h-5 w-5 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">שקילת בוקר</h2>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
          שקילת בוקר (בצום ולאחר התרוקנות נוזלים) נותנת את התמונה המדויקת ביותר. אפשר גם להזין רטרואקטיבית ימים שפוספסו.
        </p>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Calendar className="pointer-events-none absolute inset-y-0 right-3 flex h-full items-center text-zinc-600 dark:text-zinc-500" />
            <DateField
              value={formDate}
              max={today}
              onChange={handleDateChange}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-3 pe-10 ps-4 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={formWeight}
              onChange={(e) => setFormWeight(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="משקל"
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
            />
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-zinc-600 dark:text-zinc-500">
              ק״ג
            </span>
          </div>
          <button type="button" onClick={handleSave} className="btn-primary shrink-0 sm:px-6">
            שמירה
          </button>
          <button type="button" onClick={() => setIsBulkModalOpen(true)} className="btn-secondary shrink-0">
            <Zap className="h-4 w-4" />
            הזנה מרוכזת ⚡
          </button>
        </div>

        {currentWeek && (
          <div className="flex items-center justify-between rounded-xl border border-lime-400/20 bg-lime-400/5 p-4">
            <div>
              <p className="text-xs text-zinc-600 dark:text-zinc-500">ממוצע שבועי (השבוע הנוכחי)</p>
              <p className="text-2xl font-extrabold text-lime-700 dark:text-lime-400">{currentWeek.averageKg} ק״ג</p>
            </div>
            <TrendBadge delta={currentWeek.deltaFromPreviousWeek} />
          </div>
        )}
      </div>

      {recentWeeks.length > 0 && (
        <div className="glass-card p-5 sm:p-6">
          <WeightTrendChart logs={logs} title="מגמת משקל" />


          <div className="mt-5 flex flex-col gap-2">
            {[...recentWeeks].reverse().map((week) => (
              <div key={week.weekStart} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40">
                <button
                  type="button"
                  onClick={() => setExpandedWeek((w) => (w === week.weekStart ? null : week.weekStart))}
                  className="flex w-full items-center justify-between p-3.5 text-right"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-500 transition-transform ${
                        expandedWeek === week.weekStart ? 'rotate-180' : ''
                      }`}
                    />
                    <div>
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {formatDateDisplay(week.weekStart)} - {formatDateDisplay(week.weekEnd)}
                      </p>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-500">{week.daysLogged} ימים נשקלו</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{week.averageKg} ק״ג</span>
                    <TrendBadge delta={week.deltaFromPreviousWeek} />
                  </div>
                </button>

                {expandedWeek === week.weekStart && (
                  <div className="flex flex-col gap-1.5 border-t border-zinc-200 dark:border-zinc-800 p-3.5 pt-3">
                    {week.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg bg-white/60 dark:bg-zinc-900/60 px-3 py-2"
                      >
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">{formatDateDisplay(entry.date)}</span>
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{entry.weightKg} ק״ג</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingEntry(entry)}
                            aria-label="עריכה"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-lime-700 dark:hover:text-lime-400"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(entry.id)}
                            aria-label="מחיקה"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 && (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-500">עדיין אין שקילות. הזן/י את השקילה הראשונה למעלה כדי להתחיל לעקוב.</p>
        </div>
      )}

      {editingEntry && (
        <WeightEditModal
          entry={editingEntry}
          takenDates={logs.filter((l) => l.id !== editingEntry.id).map((l) => l.date)}
          today={today}
          onSave={(next) => saveEditedEntry(editingEntry, next)}
          onDelete={() => {
            onDelete(editingEntry.id);
            setEditingEntry(null);
            setToastMessage('השקילה נמחקה');
          }}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {isBulkModalOpen && (
        <BulkWeightModal onImport={handleBulkImportConfirm} onClose={() => setIsBulkModalOpen(false)} />
      )}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </div>
  );
}

