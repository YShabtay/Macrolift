import { useMemo } from 'react';
import { AlertTriangle, CalendarRange, Ruler, TrendingUp } from 'lucide-react';
import type { TrainingExperience } from '../types/fitness';
import {
  BULKING_DURATION_OPTIONS,
  BULKING_REGIONS,
  describeBulkingPlan,
  formatCm,
  parseBulkingDraft,
  REGION_LABELS,
  type BulkingDraft,
  type PaceVerdict,
} from '../utils/bulkingPlan';
import { getEffectiveExperience } from '../utils/bodyMeasurements';

const VERDICT_STYLES: Record<PaceVerdict, { label: string; className: string }> = {
  realistic: { label: 'קצב ריאלי', className: 'bg-lime-400/10 text-lime-700 dark:text-lime-400' },
  ambitious: { label: 'קצב שאפתני', className: 'bg-orange-400/10 text-orange-700 dark:text-orange-400' },
  unrealistic: { label: 'קצב לא סביר', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

interface BulkingPlanEditorProps {
  draft: BulkingDraft;
  onChange: (draft: BulkingDraft) => void;
  experienceYears: TrainingExperience | undefined;
}

/** Planning fields for a bulking period (duration + circumference-gain targets) with live monthly-pace feedback. */
export default function BulkingPlanEditor({ draft, onChange, experienceYears }: BulkingPlanEditorProps) {
  const result = useMemo(() => parseBulkingDraft(draft), [draft]);
  const rows = useMemo(
    () => (result.status === 'ok' ? describeBulkingPlan(result.plan, getEffectiveExperience(experienceYears)) : []),
    [result, experienceYears],
  );

  const set = (patch: Partial<BulkingDraft>) => onChange({ ...draft, ...patch });
  const hasDuration = draft.durationText.trim() !== '';

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-3.5 animate-fade-in">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-orange-700 dark:text-orange-400" />
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">תכנון תקופת מסה</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">משך תקופת המסה (חודשים)</label>
        <div className="flex flex-wrap gap-1.5">
          {BULKING_DURATION_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ durationText: String(m) })}
              className={`h-9 min-w-9 rounded-lg border px-3 text-xs font-bold transition ${
                draft.durationText === String(m)
                  ? 'border-orange-400/60 bg-orange-400/10 text-orange-700 dark:text-orange-400'
                  : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {m}
            </button>
          ))}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={24}
            value={draft.durationText}
            onChange={(e) => set({ durationText: e.target.value })}
            placeholder="אחר"
            aria-label="משך תקופת המסה בחודשים"
            className="h-9 w-20 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-center text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-orange-400"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-500">
          <Ruler className="h-3.5 w-3.5" />
          יעד עלייה בהיקפים (ס״מ)
        </label>
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {(['overall', 'per_region'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => set({ gainMode: mode })}
              className={`rounded-lg border py-2 text-xs font-semibold transition ${
                draft.gainMode === mode
                  ? 'border-orange-400/60 bg-orange-400/10 text-orange-700 dark:text-orange-400'
                  : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {mode === 'overall' ? 'כללי (לכל האזורים)' : 'לפי אזור'}
            </button>
          ))}
        </div>

        {draft.gainMode === 'overall' ? (
          <GainInput label="עלייה כוללת לכל אזור" value={draft.overallText} onChange={(v) => set({ overallText: v })} />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {BULKING_REGIONS.map((region) => (
              <GainInput
                key={region}
                label={REGION_LABELS[region]}
                value={draft.regionText[region]}
                onChange={(v) => set({ regionText: { ...draft.regionText, [region]: v } })}
              />
            ))}
          </div>
        )}
      </div>

      {result.status === 'invalid' && hasDuration && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {result.error}
        </p>
      )}

      {rows.length > 0 && result.status === 'ok' && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-500">
            <TrendingUp className="h-3.5 w-3.5" />
            קצב גדילה חודשי צפוי
          </p>
          {rows.map((row) => (
            <div key={row.region} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {row.label}: {formatCm(row.totalGainCm)} ס״מ ב-{result.plan.durationMonths} חודשים
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="font-extrabold text-zinc-900 dark:text-zinc-100">≈ {formatCm(row.perMonthCm)} ס״מ/חודש</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${VERDICT_STYLES[row.verdict].className}`}>
                  {VERDICT_STYLES[row.verdict].label}
                </span>
              </span>
            </div>
          ))}
          <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500">
            ההערכה מושווית לקצב הגדילה הטבעי לפי ותק האימונים שלך.
          </p>
        </div>
      )}
    </div>
  );
}

function GainInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-600 dark:text-zinc-500">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ס״מ"
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-2 text-center text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-orange-400"
      />
    </label>
  );
}
