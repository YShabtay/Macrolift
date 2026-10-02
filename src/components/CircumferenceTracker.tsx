import { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, ChevronDown, Plus, Ruler, Target, Trash2 } from 'lucide-react';
import type { BodyMeasurements, BulkingPlan, CircumferenceEntry, CircumferenceGoals, Goal, TrainingExperience } from '../types/fitness';
import {
  EXPERIENCE_LABELS,
  estimateMonthsToGoal,
  getEffectiveExperience,
  getLatestValue,
  getMonthlyGrowthRateCm,
  getWaistCeilingWarning,
  isRealisticGoal,
  METRIC_LABELS,
  type GrowthMetric,
} from '../utils/bodyMeasurements';
import { formatDateDisplay, todayIso } from '../utils/weightCalculations';
import { describeBulkingPlan, formatCm, getBulkingProgress, getElapsedMonths } from '../utils/bulkingPlan';

const GROWTH_METRICS: GrowthMetric[] = ['armCm', 'chestCm', 'hipCm'];
const GOAL_LABELS_SHORT: Record<Goal, string> = {
  lose_weight: 'ירידה במשקל',
  maintain: 'שמירה על המשקל',
  gain_muscle: 'מסה מבוקרת',
  recomp: 'שיפור הרכב גוף',
};

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
        עקיבה אחר זרוע, חזה, מותניים וירך, עם תחזית ריאלית לזמן ההגעה ליעד לפי ותק האימונים שלך
        {' '}({EXPERIENCE_LABELS[experience]}).
      </p>

      {waistWarning && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-orange-400/30 bg-orange-400/5 px-3.5 py-2.5 text-xs leading-relaxed text-orange-700 dark:text-orange-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {waistWarning}
        </div>
      )}

      {goal === 'gain_muscle' && (
        <BulkingPlanCard plan={bulkingPlan} logs={logs} experience={experience} />
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GROWTH_METRICS.map((metric) => (
          <GrowthMetricCard
            key={metric}
            metric={metric}
            current={getLatestValue(logs, metric)}
            goalValue={goals[metric]}
            experience={experience}
            goalLabel={GOAL_LABELS_SHORT[goal]}
          />
        ))}
        <WaistMetricCard current={getLatestValue(logs, 'waistCm')} goalValue={goals.waistCm} />
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
        <button
          type="button"
          onClick={() => setIsEditingGoals((v) => !v)}
          className="btn-secondary text-xs"
        >
          <Target className="h-3.5 w-3.5" />
          הגדרת יעדים
        </button>
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

      {isEditingGoals && (
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

function GrowthMetricCard({
  metric,
  current,
  goalValue,
  experience,
  goalLabel,
}: {
  metric: GrowthMetric;
  current: number | undefined;
  goalValue: number | undefined;
  experience: TrainingExperience;
  goalLabel: string;
}) {
  const label = METRIC_LABELS[metric];

  if (current === undefined) {
    return <EmptyCard label={label} />;
  }

  if (goalValue === undefined) {
    return <CurrentOnlyCard label={label} current={current} />;
  }

  const delta = Math.round((goalValue - current) * 10) / 10;
  const rate = getMonthlyGrowthRateCm(metric, experience);
  const months = estimateMonthsToGoal(current, goalValue, rate);
  const realistic = isRealisticGoal(metric, current, goalValue);

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
        <>
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            יעד: {goalValue} ס״מ <span className="text-zinc-500 dark:text-zinc-500">(נותרו {delta} ס״מ)</span>
          </p>
          {!realistic ? (
            <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-relaxed text-orange-700 dark:text-orange-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              זהו יעד שאינו ריאלי באופן טבעי - שקלו יעד מתון יותר
            </p>
          ) : (
            months !== null && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
                זמן הגעה משוער: כ-{months} חודשים ב{goalLabel} בקצב נוכחי
              </p>
            )
          )}
        </>
      )}
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

const VERDICT_LABELS = { realistic: 'ריאלי', ambitious: 'שאפתני', unrealistic: 'לא סביר' } as const;

function BulkingPlanCard({
  plan,
  logs,
  experience,
}: {
  plan: BulkingPlan | undefined;
  logs: CircumferenceEntry[];
  experience: TrainingExperience;
}) {
  const today = todayIso();
  const rows = useMemo(() => (plan ? describeBulkingPlan(plan, experience) : []), [plan, experience]);
  const progress = useMemo(() => (plan ? getBulkingProgress(plan, logs, today) : []), [plan, logs, today]);

  if (!plan) {
    return (
      <p className="mb-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
        אפשר לתכנן תקופת מסה (משך ויעד עלייה בהיקפים) דרך "עריכת פרטים" בלשונית הפרופיל.
      </p>
    );
  }

  const elapsed = getElapsedMonths(plan, today);
  const elapsedPct = Math.round((elapsed / plan.durationMonths) * 100);
  const remaining = Math.max(plan.durationMonths - elapsed, 0);

  return (
    <div className="mb-4 rounded-xl border border-orange-400/20 bg-orange-400/5 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">תקופת מסה: {plan.durationMonths} חודשים</p>
        <span className="text-[11px] text-zinc-600 dark:text-zinc-500">
          התחלה {formatDateDisplay(plan.startDate)} · נותרו כ-{Math.round(remaining * 10) / 10} חודשים
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${elapsedPct}%` }} />
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-500">לא הוגדרו יעדי עלייה בהיקפים - אפשר להוסיף דרך "עריכת פרטים".</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const p = progress.find((x) => x.region === row.region);
            return (
              <div key={row.region} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {row.label}: יעד {formatCm(row.totalGainCm)} ס״מ
                  <span className="mr-1 text-[11px] font-normal text-zinc-600 dark:text-zinc-500">
                    (≈ {formatCm(row.perMonthCm)} ס״מ/חודש · {VERDICT_LABELS[row.verdict]})
                  </span>
                </span>
                <span className="shrink-0 font-bold text-zinc-900 dark:text-zinc-100">
                  {p?.gainedCm == null ? 'אין מספיק מדידות' : `${p.gainedCm > 0 ? '+' : ''}${formatCm(p.gainedCm)} ס״מ`}
                  {p?.gainedCm != null && (
                    <span className="mr-1 text-[11px] font-normal text-zinc-600 dark:text-zinc-500">מתוך {formatCm(p.expectedCm)} צפוי</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
