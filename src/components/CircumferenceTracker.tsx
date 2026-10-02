import { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, ChevronDown, Plus, Ruler, Target, Trash2 } from 'lucide-react';
import type { BodyMeasurements, BulkingPlan, CircumferenceEntry, CircumferenceGoals, Goal, TrainingExperience } from '../types/fitness';
import {
  EXPERIENCE_LABELS,
  estimateMonthsToGoal,
  forecastGrowthCm,
  getEffectiveExperience,
  getLatestValue,
  getMonthlyGrowthRateCm,
  getWaistCeilingCm,
  getWaistCeilingWarning,
  isRealisticGoal,
  METRIC_LABELS,
  type GrowthMetric,
} from '../utils/bodyMeasurements';
import { formatDateDisplay, todayIso } from '../utils/weightCalculations';
import { formatCm, formatRangeCm, getBulkingProgress, getElapsedMonths } from '../utils/bulkingPlan';

const GROWTH_METRICS: GrowthMetric[] = ['armCm', 'chestCm', 'hipCm'];

type GoalMode = 'duration' | 'target';

const BASE_MONTH_OPTIONS = [3, 6, 9, 12];
const MODE_STORAGE_KEY = 'macrolift-circumference-mode';
const MONTHS_STORAGE_KEY = 'macrolift-circumference-months';

function readStoredMode(): GoalMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'target' ? 'target' : 'duration';
  } catch {
    return 'duration';
  }
}

function readStoredMonths(fallback: number): number {
  try {
    const n = Number(localStorage.getItem(MONTHS_STORAGE_KEY));
    return Number.isInteger(n) && n >= 1 && n <= 24 ? n : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: the choice just won't be remembered.
  }
}

interface CircumferenceTrackerProps {
  logs: CircumferenceEntry[];
  goals: CircumferenceGoals;
  goal: Goal;
  experienceYears: TrainingExperience | undefined;
  bulkingPlan?: BulkingPlan;
  onSaveEntry: (date: string, measurements: BodyMeasurements) => void;
  onDeleteEntry: (id: string) => void;
  onSaveGoals: (goals: CircumferenceGoals) => void;
}

export default function CircumferenceTracker({
  logs,
  goals,
  goal,
  experienceYears,
  bulkingPlan,
  onSaveEntry,
  onDeleteEntry,
  onSaveGoals,
}: CircumferenceTrackerProps) {
  const [isAddingMeasurement, setIsAddingMeasurement] = useState(false);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [mode, setMode] = useState<GoalMode>(readStoredMode);
  const [months, setMonths] = useState(() => readStoredMonths(bulkingPlan?.durationMonths ?? 6));
  const monthOptions = useMemo(() => [...new Set([...BASE_MONTH_OPTIONS, months])].sort((a, b) => a - b), [months]);

  function changeMode(next: GoalMode) {
    setMode(next);
    persist(MODE_STORAGE_KEY, next);
  }

  function changeMonths(next: number) {
    setMonths(next);
    persist(MONTHS_STORAGE_KEY, String(next));
  }

  const experience = getEffectiveExperience(experienceYears);
  const sortedLogs = useMemo(() => [...logs].sort((a, b) => (a.date < b.date ? 1 : -1)), [logs]);
  const waistWarning = useMemo(() => getWaistCeilingWarning(logs, goal), [logs, goal]);

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Ruler className="h-5 w-5 text-lime-700 dark:text-lime-400" />
        <h2 className="font-bold text-zinc-900 dark:text-zinc-100">יעדי היקפים ותחזית גדילה</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
        עקיבה אחר זרוע, חזה, מותניים וירך, עם תחזית ריאלית לפי ותק האימונים שלך
        {' '}({EXPERIENCE_LABELS[experience]}).
      </p>

      {mode === 'target' && waistWarning && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-orange-400/30 bg-orange-400/5 px-3.5 py-2.5 text-xs leading-relaxed text-orange-700 dark:text-orange-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {waistWarning}
        </div>
      )}

      <div role="tablist" aria-label="מצב יעד בהיקפים" className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/70 p-1">
        {(
          [
            ['duration', 'לפי משך תקופה (חודשים)'],
            ['target', 'לפי יעד מספרי (ס״מ)'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => changeMode(id)}
            className={`rounded-lg px-2 py-2.5 text-xs font-bold transition ${
              mode === id
                ? 'bg-lime-400 text-zinc-950 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'duration' && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-500">משך תקופת המסה</p>
          <div className="flex flex-wrap gap-1.5">
            {monthOptions.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => changeMonths(m)}
                className={`h-9 min-w-[4.5rem] rounded-lg border px-3 text-xs font-bold transition ${
                  months === m
                    ? 'border-lime-400/60 bg-lime-400/10 text-lime-700 dark:text-lime-400'
                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {m} חודשים
              </button>
            ))}
          </div>
          {goal !== 'gain_muscle' && (
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">התחזית מניחה תקופת עלייה במסה (עודף קלורי מבוקר).</p>
          )}
        </div>
      )}

      {mode === 'duration' && goal === 'gain_muscle' && bulkingPlan && bulkingPlan.durationMonths === months && (
        <BulkingPlanCard plan={bulkingPlan} logs={logs} experience={experience} />
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GROWTH_METRICS.map((metric) =>
          mode === 'duration' ? (
            <DurationMetricCard
              key={metric}
              metric={metric}
              current={getLatestValue(logs, metric)}
              months={months}
              experience={experience}
            />
          ) : (
            <TargetMetricCard
              key={metric}
              metric={metric}
              current={getLatestValue(logs, metric)}
              goalValue={goals[metric]}
              experience={experience}
            />
          ),
        )}
        {mode === 'duration' ? (
          <WaistDurationCard current={getLatestValue(logs, 'waistCm')} ceilingCm={goal === 'gain_muscle' ? getWaistCeilingCm(logs) : null} />
        ) : (
          <WaistMetricCard current={getLatestValue(logs, 'waistCm')} goalValue={goals.waistCm} />
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsAddingMeasurement((v) => !v)}
          className="btn-primary text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          עדכן מדידה חדשה
        </button>
        {mode === 'target' && (
          <button
            type="button"
            onClick={() => setIsEditingGoals((v) => !v)}
            className="btn-secondary text-xs"
          >
            <Target className="h-3.5 w-3.5" />
            הגדרת יעדים
          </button>
        )}
      </div>

      {isAddingMeasurement && (
        <MeasurementForm
          logs={logs}
          onSave={(date, measurements) => {
            onSaveEntry(date, measurements);
            setIsAddingMeasurement(false);
          }}
          onCancel={() => setIsAddingMeasurement(false)}
        />
      )}

      {mode === 'target' && isEditingGoals && (
        <GoalsForm
          goals={goals}
          onSave={(next) => {
            onSaveGoals(next);
            setIsEditingGoals(false);
          }}
          onCancel={() => setIsEditingGoals(false)}
        />
      )}

      {sortedLogs.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setIsHistoryOpen((v) => !v)}
            className="flex w-full items-center justify-between p-3.5 text-right"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-zinc-600 dark:text-zinc-500" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                היסטוריית מדידות ({sortedLogs.length})
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-500 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isHistoryOpen && (
            <div className="flex flex-col gap-1.5 border-t border-zinc-200 dark:border-zinc-800 p-3.5 pt-3">
              {sortedLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/60 dark:bg-zinc-900/60 px-3 py-2"
                >
                  <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">{formatDateDisplay(entry.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-700 dark:text-zinc-300">
                    {(['armCm', 'chestCm', 'waistCm', 'hipCm'] as const)
                      .filter((m) => entry[m] !== undefined)
                      .map((m) => `${METRIC_LABELS[m]} ${entry[m]}`)
                      .join(' · ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteEntry(entry.id)}
                    aria-label="מחיקת מדידה"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sortedLogs.length === 0 && !isAddingMeasurement && (
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-500">
          עדיין אין מדידות. לחצו על "עדכן מדידה חדשה" כדי להתחיל לעקוב.
        </p>
      )}
    </div>
  );
}

const CARD_CLASS = 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5';

function CurrentValue({ label, current }: { label: string; current: number }) {
  return (
    <>
      <p className="text-xs text-zinc-600 dark:text-zinc-500">{label}</p>
      <p className="mb-2 text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
        {current}
        <span className="mr-1 text-xs font-normal text-zinc-600 dark:text-zinc-500">ס״מ</span>
      </p>
    </>
  );
}

/** Duration mode: what a realistic bulk of N months adds to this region, and where that lands. */
function DurationMetricCard({
  metric,
  current,
  months,
  experience,
}: {
  metric: GrowthMetric;
  current: number | undefined;
  months: number;
  experience: TrainingExperience;
}) {
  const label = METRIC_LABELS[metric];
  if (current === undefined) return <EmptyCard label={label} />;

  const { minCm, maxCm } = forecastGrowthCm(metric, experience, months);

  return (
    <div className={CARD_CLASS}>
      <CurrentValue label={label} current={current} />
      <p className="text-[11px] text-zinc-600 dark:text-zinc-500">צפי עלייה ב-{months} חודשים</p>
      <p className="whitespace-nowrap text-sm font-extrabold text-lime-700 dark:text-lime-400">+{formatRangeCm(minCm, maxCm)} ס״מ</p>
      <p className="mt-1.5 text-[11px] text-zinc-600 dark:text-zinc-500">
        היקף צפוי בסיום: <b className="whitespace-nowrap">{formatRangeCm(Math.round((current + minCm) * 10) / 10, Math.round((current + maxCm) * 10) / 10)} ס״מ</b>
      </p>
    </div>
  );
}

/** Target mode: the user's own cm goal, what's left, and a controlled-pace estimate to get there. */
function TargetMetricCard({
  metric,
  current,
  goalValue,
  experience,
}: {
  metric: GrowthMetric;
  current: number | undefined;
  goalValue: number | undefined;
  experience: TrainingExperience;
}) {
  const label = METRIC_LABELS[metric];
  if (current === undefined) return <EmptyCard label={label} />;
  if (goalValue === undefined) return <CurrentOnlyCard label={label} current={current} />;

  const delta = Math.round((goalValue - current) * 10) / 10;
  const months = estimateMonthsToGoal(current, goalValue, getMonthlyGrowthRateCm(metric, experience));

  return (
    <div className={CARD_CLASS}>
      <CurrentValue label={label} current={current} />
      {delta <= 0 ? (
        <p className="text-xs font-semibold text-lime-700 dark:text-lime-400">היעד הושג! 🎉</p>
      ) : (
        <>
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            יעד: <b>{goalValue} ס״מ</b> <span className="text-zinc-500">(נותרו {delta} ס״מ)</span>
          </p>
          {!isRealisticGoal(metric, current, goalValue) ? (
            <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-relaxed text-orange-700 dark:text-orange-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              זהו יעד שאינו ריאלי באופן טבעי - שקלו יעד מתון יותר
            </p>
          ) : (
            months !== null && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
                משך משוער בקצב מבוקר: <b>כ-{months} חודשים</b> להגעה
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}

/** Duration mode: the waist isn't a growth target - show where it is and the line to stay under for a clean bulk. */
function WaistDurationCard({ current, ceilingCm }: { current: number | undefined; ceilingCm: number | null }) {
  const label = METRIC_LABELS.waistCm;
  if (current === undefined) return <EmptyCard label={label} />;
  return (
    <div className={CARD_CLASS}>
      <CurrentValue label={label} current={current} />
      <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
        {ceilingCm !== null ? (
          <>
            לעלייה נקייה: מתחת ל-<b>{ceilingCm} ס״מ</b>
          </>
        ) : (
          'מדד לבקרת שומן'
        )}
      </p>
    </div>
  );
}

function WaistMetricCard({ current, goalValue }: { current: number | undefined; goalValue: number | undefined }) {
  const label = METRIC_LABELS.waistCm;

  if (current === undefined) {
    return <EmptyCard label={label} />;
  }

  if (goalValue === undefined) {
    return <CurrentOnlyCard label={label} current={current} />;
  }

  const delta = Math.round((current - goalValue) * 10) / 10;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
      <p className="text-xs text-zinc-600 dark:text-zinc-500">{label}</p>
      <p className="mb-1.5 text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
        {current}
        <span className="mr-1 text-xs font-normal text-zinc-600 dark:text-zinc-500">ס״מ</span>
      </p>
      {delta <= 0 ? (
        <p className="text-xs font-semibold text-lime-700 dark:text-lime-400">היעד הושג! 🎉</p>
      ) : (
        <p className="text-xs text-zinc-700 dark:text-zinc-300">
          יעד: {goalValue} ס״מ <span className="text-zinc-500 dark:text-zinc-500">(נותרו {delta} ס״מ)</span>
        </p>
      )}
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3.5">
      <p className="text-xs text-zinc-600 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-600">אין מדידה עדיין</p>
    </div>
  );
}

function CurrentOnlyCard({ label, current }: { label: string; current: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3.5">
      <p className="text-xs text-zinc-600 dark:text-zinc-500">{label}</p>
      <p className="mb-1.5 text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
        {current}
        <span className="mr-1 text-xs font-normal text-zinc-600 dark:text-zinc-500">ס״מ</span>
      </p>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-600">לא הוגדר יעד</p>
    </div>
  );
}

function MeasurementForm({
  logs,
  onSave,
  onCancel,
}: {
  logs: CircumferenceEntry[];
  onSave: (date: string, measurements: BodyMeasurements) => void;
  onCancel: () => void;
}) {
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [armCm, setArmCm] = useState('');
  const [chestCm, setChestCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [hipCm, setHipCm] = useState('');

  function handleDateChange(nextDate: string) {
    setDate(nextDate);
    const existing = logs.find((l) => l.date === nextDate);
    setArmCm(existing?.armCm != null ? String(existing.armCm) : '');
    setChestCm(existing?.chestCm != null ? String(existing.chestCm) : '');
    setWaistCm(existing?.waistCm != null ? String(existing.waistCm) : '');
    setHipCm(existing?.hipCm != null ? String(existing.hipCm) : '');
  }

  function handleSave() {
    const measurements: BodyMeasurements = {
      armCm: armCm.trim() ? Number(armCm) : undefined,
      chestCm: chestCm.trim() ? Number(chestCm) : undefined,
      waistCm: waistCm.trim() ? Number(waistCm) : undefined,
      hipCm: hipCm.trim() ? Number(hipCm) : undefined,
    };
    if (Object.values(measurements).every((v) => v === undefined)) return;
    onSave(date, measurements);
  }

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 p-3.5">
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">תאריך</label>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <MeasurementInput label="זרוע (ס״מ)" value={armCm} onChange={setArmCm} />
        <MeasurementInput label="חזה (ס״מ)" value={chestCm} onChange={setChestCm} />
        <MeasurementInput label="מותניים (ס״מ)" value={waistCm} onChange={setWaistCm} />
        <MeasurementInput label="ירך (ס״מ)" value={hipCm} onChange={setHipCm} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={handleSave} className="btn-primary flex-1 text-xs">
          שמירה
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-xs">
          ביטול
        </button>
      </div>
    </div>
  );
}

function GoalsForm({
  goals,
  onSave,
  onCancel,
}: {
  goals: CircumferenceGoals;
  onSave: (goals: CircumferenceGoals) => void;
  onCancel: () => void;
}) {
  const [armCm, setArmCm] = useState(goals.armCm != null ? String(goals.armCm) : '');
  const [chestCm, setChestCm] = useState(goals.chestCm != null ? String(goals.chestCm) : '');
  const [waistCm, setWaistCm] = useState(goals.waistCm != null ? String(goals.waistCm) : '');
  const [hipCm, setHipCm] = useState(goals.hipCm != null ? String(goals.hipCm) : '');

  function handleSave() {
    onSave({
      armCm: armCm.trim() ? Number(armCm) : undefined,
      chestCm: chestCm.trim() ? Number(chestCm) : undefined,
      waistCm: waistCm.trim() ? Number(waistCm) : undefined,
      hipCm: hipCm.trim() ? Number(hipCm) : undefined,
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-lime-400/30 bg-lime-400/5 p-3.5">
      <p className="mb-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300">יעדי היקפים (ס״מ)</p>
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <MeasurementInput label="זרוע" value={armCm} onChange={setArmCm} />
        <MeasurementInput label="חזה" value={chestCm} onChange={setChestCm} />
        <MeasurementInput label="מותניים" value={waistCm} onChange={setWaistCm} />
        <MeasurementInput label="ירך" value={hipCm} onChange={setHipCm} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} className="btn-primary flex-1 text-xs">
          שמירת יעדים
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-xs">
          ביטול
        </button>
      </div>
    </div>
  );
}

function MeasurementInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-500">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-lime-400"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulking period plan
// ---------------------------------------------------------------------------

function BulkingPlanCard({ plan, logs, experience }: { plan: BulkingPlan; logs: CircumferenceEntry[]; experience: TrainingExperience }) {
  const today = todayIso();
  const progress = useMemo(() => getBulkingProgress(plan, logs, experience, today), [plan, logs, experience, today]);

  const elapsed = getElapsedMonths(plan, today);
  const elapsedPct = Math.round((elapsed / plan.durationMonths) * 100);
  const remaining = Math.max(plan.durationMonths - elapsed, 0);

  return (
    <div className="mb-4 rounded-xl border border-orange-400/20 bg-orange-400/5 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">התקדמות בתקופת המסה</p>
        <span className="text-[11px] text-zinc-600 dark:text-zinc-500">
          התחלה {formatDateDisplay(plan.startDate)} · נותרו כ-{Math.round(remaining * 10) / 10} חודשים
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${elapsedPct}%` }} />
      </div>

      <div className="flex flex-col gap-2">
        {progress.map((p) => (
          <div key={p.region} className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{p.label}</span>
            <span className="shrink-0 font-bold text-zinc-900 dark:text-zinc-100">
              {p.gainedCm == null ? 'אין מספיק מדידות' : `${p.gainedCm > 0 ? '+' : ''}${formatCm(p.gainedCm)} ס״מ`}
              {p.gainedCm != null && (
                <span className="mr-1 text-[11px] font-normal text-zinc-600 dark:text-zinc-500">מתוך כ-{formatCm(p.expectedCm)} צפוי עד כה</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
