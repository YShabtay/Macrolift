import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Save, X, Zap } from 'lucide-react';
import { parseBulkWeightInput, type BulkWeightEntry } from '../utils/bulkWeightParser';
import { formatDateDisplay } from '../utils/weightCalculations';

interface BulkWeightModalProps {
  onImport: (entries: BulkWeightEntry[]) => void;
  onClose: () => void;
}

export default function BulkWeightModal({ onImport, onClose }: BulkWeightModalProps) {
  const [text, setText] = useState('');

  const { entries, skippedCount } = useMemo(() => parseBulkWeightInput(text), [text]);
  const hasInput = text.trim().length > 0;

  function handleImport() {
    if (entries.length === 0) return;
    onImport(entries);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card neon-border flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
              <Zap className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">הזנה מרוכזת של שקילות</h3>
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

        <div className="flex flex-col gap-4 p-4">
          <div>
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              הדבק כאן נתונים מאקסל, Google Sheets או רשימת טקסט (כל שורה: תאריך ומשקל).
            </p>
            <div className="mt-2 flex flex-col gap-0.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
              <p>פורמטים נתמכים, שורה לכל שקילה:</p>
              <p dir="ltr" className="font-mono">
                15/03/2026 68.2
              </p>
              <p dir="ltr" className="font-mono">
                2026-03-15, 68.2
              </p>
              <p>ניתן להדביק ישירות מתאי Excel / Sheets (מופרדים ב-Tab או פסיק).</p>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'15/03/2026 68.2\n16/03/2026 68.0\n17/03/2026 67.8'}
            dir="ltr"
            rows={8}
            className="w-full resize-y rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-left font-mono text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
          />

          {hasInput && (
            <div className="flex flex-col gap-2">
              <div
                className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${
                  entries.length > 0
                    ? 'border-lime-400/30 bg-lime-400/5 text-lime-700 dark:text-lime-400'
                    : 'border-orange-400/30 bg-orange-400/5 text-orange-700 dark:text-orange-400'
                }`}
              >
                {entries.length > 0 ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                {entries.length > 0 ? `זוהו ${entries.length} שקילות תקינות` : 'לא זוהו שקילות תקינות בטקסט שהודבק'}
              </div>

              {skippedCount > 0 && (
                <p className="text-[11px] font-medium text-orange-700 dark:text-orange-400">
                  {skippedCount} שורות לא זוהו ונשמטו (בדוק/י פורמט תאריך/משקל)
                </p>
              )}

              {entries.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  {entries.map((entry) => (
                    <div
                      key={entry.date}
                      className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 px-3 py-1.5 text-xs last:border-b-0"
                    >
                      <span className="text-zinc-600 dark:text-zinc-400">{formatDateDisplay(entry.date)}</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{entry.weightKg} ק״ג</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={entries.length === 0}
              className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              שמור ועדכן גרף
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
