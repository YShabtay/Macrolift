import { useMemo, useState } from 'react';
import { Award, BarChart3, ChevronLeft, ChevronRight, Droplets, Dumbbell, Flame, Footprints, Scale, Trophy, UtensilsCrossed } from 'lucide-react';
import type { AppState } from '../types/fitness';
import { useToday } from '../hooks/useToday';
import { buildWeeklySummary } from '../utils/weeklySummary';
import { getDoneWorkoutDates, getLoggingStreakDays, getWorkoutMilestone, getWorkoutStreakWeeks } from '../utils/streaks';
import { addDaysIso } from '../utils/dateMath';
import { DEFAULT_STEP_GOAL } from '../utils/stepsCalculations';
import { formatDateDisplay } from '../utils/weightCalculations';

/** How far back the week navigation goes. */
const MAX_WEEKS_BACK = 52;
const HISTORY_WEEKS = 8;

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Dumbbell; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
        <Icon className="h-3.5 w-3.5 text-lime-700 dark:text-lime-400" />
        {label}
      </div>
      <p className="text-lg font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
      {hint && <p className="text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}

/** "This week" / "last week" at a glance - workouts, sets and personal records, steps, nutrition, water, weight - plus the streaks that keep it going. */
export default function WeeklySummaryCard({ appState }: { appState: AppState }) {
  const today = useToday();
  const [offset, setOffset] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const weekDate = addDaysIso(today, -7 * offset);

  const summary = useMemo(() => buildWeeklySummary(appState, weekDate, today, DEFAULT_STEP_GOAL), [appState, weekDate, today]);
  const history = useMemo(
    () => (isHistoryOpen ? Array.from({ length: HISTORY_WEEKS }, (_, i) => buildWeeklySummary(appState, addDaysIso(today, -7 * i), today, DEFAULT_STEP_GOAL)) : []),
    [appState, today, isHistoryOpen],
  );
  const streaks = useMemo(
    () => ({
      logging: getLoggingStreakDays(appState.foodLog, today),
      weeks: getWorkoutStreakWeeks(appState, today),
      milestone: getWorkoutMilestone(getDoneWorkoutDates(appState).length),
    }),
    [appState, today],
  );

  const { workouts, nutrition, steps, water, weight } = summary;
  const hasAnything = workouts.done > 0 || summary.sets > 0 || nutrition.daysLogged > 0 || steps.daysLogged > 0 || water.daysLogged > 0 || weight.latest !== null;

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-lime-700 dark:text-lime-400" />
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">סיכום שבועי</h2>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="ניווט בין שבועות">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.min(o + 1, MAX_WEEKS_BACK))}
            disabled={offset >= MAX_WEEKS_BACK}
            aria-label="שבוע קודם"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs font-bold text-zinc-800 dark:text-zinc-200">
            {offset === 0 ? 'השבוע' : offset === 1 ? 'שבוע שעבר' : `לפני ${offset} שבועות`}
          </span>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(o - 1, 0))}
            disabled={offset === 0}
            aria-label="שבוע הבא"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-zinc-500">
        {formatDateDisplay(summary.weekStart)} - {formatDateDisplay(summary.weekEnd)}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {streaks.logging > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-orange-400/40 bg-orange-400/10 px-2.5 py-1 text-[11px] font-bold text-orange-700 dark:text-orange-300">
            <Flame className="h-3.5 w-3.5" />
            {streaks.logging} ימי תיעוד ברצף
          </span>
        )}
        {streaks.weeks > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[11px] font-bold text-lime-700 dark:text-lime-400">
            <Trophy className="h-3.5 w-3.5" />
            {streaks.weeks} {streaks.weeks === 1 ? 'שבוע אימונים ברצף' : 'שבועות אימונים ברצף'}
          </span>
        )}
        {streaks.milestone.reached !== null && (
          <span className="flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300">
            <Award className="h-3.5 w-3.5" />
            {streaks.milestone.total} אימונים בסך הכל
            {streaks.milestone.next !== null && ` • עוד ${streaks.milestone.remaining} ל-${streaks.milestone.next}`}
          </span>
        )}
      </div>

      {!hasAnything ? (
        <p className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-center text-xs text-zinc-600 dark:text-zinc-500">
          עוד אין נתונים בשבוע הזה. אימון, ארוחה או צעדים שתתעד יופיעו כאן.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Stat icon={Dumbbell} label="אימונים" value={`${workouts.done}/${workouts.planned}`} hint={summary.sets > 0 ? `${summary.sets} סטים` : undefined} />
            {summary.volumeKg > 0 && <Stat icon={Trophy} label="נפח הרמה" value={`${summary.volumeKg.toLocaleString()} ק״ג`} hint={summary.personalRecords > 0 ? `${summary.personalRecords} שיאים אישיים 🏆` : undefined} />}
            <Stat icon={Footprints} label="צעדים (ממוצע)" value={steps.average > 0 ? steps.average.toLocaleString() : '-'} hint={`יעד ${steps.goal.toLocaleString()}`} />
            <Stat
              icon={UtensilsCrossed}
              label="קלוריות (ממוצע)"
              value={nutrition.daysLogged > 0 ? nutrition.avgCalories.toLocaleString() : '-'}
              hint={`יעד ${nutrition.targetCalories.toLocaleString()}`}
            />
            <Stat icon={UtensilsCrossed} label="חלבון (ממוצע)" value={nutrition.daysLogged > 0 ? `${nutrition.avgProteinG} ג׳` : '-'} hint={`יעד ${nutrition.targetProteinG} ג׳`} />
            {water.daysLogged > 0 && <Stat icon={Droplets} label="מים (ממוצע)" value={`${(water.avgMl / 1000).toLocaleString('he-IL', { maximumFractionDigits: 1 })} ל׳`} hint={`יעד ${(water.goalMl / 1000).toLocaleString('he-IL', { maximumFractionDigits: 1 })} ל׳`} />}
            {weight.latest !== null && (
              <Stat
                icon={Scale}
                label="משקל"
                value={`${weight.latest} ק״ג`}
                hint={weight.changeKg === null ? undefined : `${weight.changeKg > 0 ? '+' : ''}${weight.changeKg} ק״ג מאז השקילה הקודמת`}
              />
            )}
          </div>
          {summary.insights.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {summary.insights.map((line) => (
                <li key={line} className="rounded-lg bg-lime-400/10 px-3 py-2 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-3">
        <button
          type="button"
          onClick={() => setIsHistoryOpen((v) => !v)}
          aria-expanded={isHistoryOpen}
          className="text-xs font-bold text-lime-700 underline underline-offset-2 dark:text-lime-400"
        >
          {isHistoryOpen ? 'הסתר' : 'הצג'} {HISTORY_WEEKS} שבועות אחרונים
        </button>
        {isHistoryOpen && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-right text-[11px]">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1 font-semibold">שבוע</th>
                  <th className="py-1 font-semibold">אימונים</th>
                  <th className="py-1 font-semibold">קלוריות</th>
                  <th className="py-1 font-semibold">צעדים</th>
                  <th className="py-1 font-semibold">משקל</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {history.map((week, i) => (
                  <tr key={week.weekStart} className={`border-t border-zinc-200/70 dark:border-zinc-800/70 ${i === offset ? 'bg-lime-400/10' : ''}`}>
                    <td className="py-1.5">
                      <button type="button" onClick={() => setOffset(i)} className="font-semibold underline-offset-2 hover:underline">
                        {formatDateDisplay(week.weekStart)}
                      </button>
                    </td>
                    <td>{week.workouts.done}/{week.workouts.planned}</td>
                    <td>{week.nutrition.daysLogged > 0 ? week.nutrition.avgCalories.toLocaleString() : '-'}</td>
                    <td>{week.steps.average > 0 ? week.steps.average.toLocaleString() : '-'}</td>
                    <td>{week.weight.latest !== null ? `${week.weight.latest}${week.weight.changeKg !== null ? ` (${week.weight.changeKg > 0 ? '+' : ''}${week.weight.changeKg})` : ''}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
