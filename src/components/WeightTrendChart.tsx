import { useMemo, useRef, useState } from 'react';
import SelectMenu, { type SelectOption } from './SelectMenu';
import type { WeightLog } from '../types/fitness';
import { daysBetween, formatDateDisplay, todayIso } from '../utils/weightCalculations';

interface WeightTrendChartProps {
  logs: WeightLog[];
  /** Card heading, rendered on the same row as the range / chart-type dropdowns. */
  title: string;
}

type RangeId = '7' | '30' | '90' | 'all';
type ChartType = 'line' | 'dots' | 'area';

const RANGES: (SelectOption<RangeId> & { days: number | null })[] = [
  { id: '7', label: 'שבוע אחרון', days: 7 },
  { id: '30', label: 'חודש אחרון', days: 30 },
  { id: '90', label: '3 חודשים', days: 90 },
  { id: 'all', label: 'כל הזמן', days: null },
];

const CHART_TYPES: SelectOption<ChartType>[] = [
  { id: 'line', label: 'קו חלק' },
  { id: 'dots', label: 'נקודות שקילה' },
  { id: 'area', label: 'שטח מוצלל' },
];

interface ChartPoint {
  date: string;
  weightKg: number;
  xPct: number;
  yPct: number;
}

function computeNiceStep(rawStep: number): number {
  if (!(rawStep > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceResidual: number;
  if (residual > 5) niceResidual = 10;
  else if (residual > 2) niceResidual = 5;
  else if (residual > 1) niceResidual = 2;
  else niceResidual = 1;
  return niceResidual * magnitude;
}

function buildTicks(yMin: number, yMax: number, targetCount = 4): number[] {
  const step = computeNiceStep((yMax - yMin) / targetCount);
  const ticks: number[] = [];
  for (let t = Math.ceil(yMin / step) * step; t <= yMax + 1e-9; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }
  return ticks.length > 0 ? ticks : [Math.round(((yMin + yMax) / 2) * 100) / 100];
}

/**
 * Smooth SVG path through the points using monotone cubic interpolation (Fritsch-Carlson): the curve
 * flows between weigh-ins but never overshoots a local min/max, so it can't invent a dip or peak.
 */
function buildSmoothPath(pts: ChartPoint[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M ${pts[0].xPct},${pts[0].yPct}`;
  if (n === 2) return `M ${pts[0].xPct},${pts[0].yPct} L ${pts[1].xPct},${pts[1].yPct}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].xPct - pts[i].xPct);
    slope.push(dx[i] === 0 ? 0 : (pts[i + 1].yPct - pts[i].yPct) / dx[i]);
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      tangent[i] = (3 * a * slope[i]) / h;
      tangent[i + 1] = (3 * b * slope[i]) / h;
    }
  }

  let d = `M ${pts[0].xPct},${pts[0].yPct}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    d += ` C ${pts[i].xPct + third},${pts[i].yPct + tangent[i] * third} ${pts[i + 1].xPct - third},${pts[i + 1].yPct - tangent[i + 1] * third} ${pts[i + 1].xPct},${pts[i + 1].yPct}`;
  }
  return d;
}

export default function WeightTrendChart({ logs, title }: WeightTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [range, setRange] = useState<RangeId>('all');
  const [chartType, setChartType] = useState<ChartType>('area');

  const sortedLogs = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? null;
    const today = todayIso();
    return [...logs]
      .filter((l) => days === null || daysBetween(l.date, today) <= days)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [logs, range]);

  const { points, ticks, yMin, yMax } = useMemo(() => {
    if (sortedLogs.length === 0) {
      return { points: [] as ChartPoint[], ticks: [] as number[], yMin: 0, yMax: 0 };
    }
    const weights = sortedLogs.map((l) => l.weightKg);
    const rawMin = Math.min(...weights);
    const rawMax = Math.max(...weights);
    const domainMin = rawMin - 1;
    const domainMax = rawMax + 1;
    const domainRange = domainMax - domainMin || 1;

    const pts: ChartPoint[] = sortedLogs.map((log, i) => ({
      date: log.date,
      weightKg: log.weightKg,
      xPct: sortedLogs.length === 1 ? 50 : (i / (sortedLogs.length - 1)) * 100,
      yPct: 100 - ((log.weightKg - domainMin) / domainRange) * 100,
    }));

    return { points: pts, ticks: buildTicks(domainMin, domainMax), yMin: domainMin, yMax: domainMax };
  }, [sortedLogs]);

  const controls = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <div className="flex items-center gap-1.5">
        <SelectMenu
          label="טווח זמן"
          value={range}
          options={RANGES}
          onChange={(v) => {
            setRange(v);
            setActiveIndex(null);
          }}
        />
        <SelectMenu label="סוג תצוגה" value={chartType} options={CHART_TYPES} onChange={setChartType} />
      </div>
    </div>
  );

  if (points.length === 0) {
    return (
      <div>
        {controls}
        <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/30 dark:bg-zinc-900/30 text-sm text-zinc-600 dark:text-zinc-500">
          {logs.length > 0 ? 'אין שקילות בטווח הזמן שנבחר' : 'אין עדיין מספיק נתונים להצגת גרף'}
        </div>
      </div>
    );
  }

  const tickYPct = (value: number) => 100 - ((value - yMin) / (yMax - yMin || 1)) * 100;

  const linePath = buildSmoothPath(points);
  const areaPath = points.length > 1 ? `${linePath} L ${points[points.length - 1].xPct},100 L ${points[0].xPct},100 Z` : '';

  const showLine = chartType !== 'dots' && points.length > 1;
  const showArea = chartType === 'area' && areaPath !== '';
  const showAllDots = chartType === 'dots';

  const active = activeIndex !== null ? points[activeIndex] : null;
  const clampedTooltipLeft = active ? Math.min(Math.max(active.xPct, 14), 86) : 0;
  // A single weigh-in has no line to show, so it always gets its dot.
  const highlighted = active ?? (points.length === 1 ? points[0] : null);

  function handlePointer(e: React.PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (points.length - 1));
    setActiveIndex(Math.min(Math.max(idx, 0), points.length - 1));
  }

  // x-axis date labels: first, last, and a couple evenly spaced in between (avoids clutter).
  const labelIndices = new Set<number>([0, points.length - 1]);
  if (points.length >= 3) labelIndices.add(Math.floor((points.length - 1) / 2));
  if (points.length >= 5) {
    labelIndices.add(Math.floor((points.length - 1) / 4));
    labelIndices.add(Math.floor(((points.length - 1) * 3) / 4));
  }

  return (
    <div className="select-none">
      {controls}

      {/* Bleeds through the card's side padding so the plot uses the card's full width; 10px insets keep the line and end labels off the very edge. */}
      <div dir="ltr" className="-mx-5 sm:-mx-6">
        <div key={`${range}-${chartType}`} className="animate-fade-in px-2.5">
          <div
            ref={containerRef}
            className="relative h-64 w-full cursor-crosshair"
            style={{ touchAction: 'pan-y' }}
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={() => setActiveIndex(null)}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <linearGradient id="weightAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a3e635" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
                </linearGradient>
              </defs>

              {ticks.map((t) => (
                <line
                  key={t}
                  x1="0"
                  y1={tickYPct(t)}
                  x2="100"
                  y2={tickYPct(t)}
                  className="stroke-zinc-200 dark:stroke-zinc-800"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {showArea && <path d={areaPath} fill="url(#weightAreaGradient)" stroke="none" />}

              {showLine && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#a3e635"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {activeIndex !== null && (
                <line
                  x1={points[activeIndex].xPct}
                  y1="0"
                  x2={points[activeIndex].xPct}
                  y2="100"
                  stroke="#a3e635"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.5"
                />
              )}
            </svg>

            {/* Y-axis values sit on top of the plot, just above their gridline, so the axis takes no width of its own. */}
            {ticks.map((t) => (
              <span
                key={t}
                className="pointer-events-none absolute left-1 -translate-y-full pb-0.5 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-500"
                style={{ top: `${tickYPct(t)}%` }}
              >
                {t}
              </span>
            ))}

            {showAllDots &&
              points.map((p, i) => (
                <div
                  key={p.date}
                  className={`pointer-events-none absolute rounded-full border-2 border-zinc-50 dark:border-zinc-950 bg-lime-400 transition-all ${
                    i === activeIndex ? 'h-3.5 w-3.5 shadow-glow' : 'h-2.5 w-2.5'
                  }`}
                  style={{ left: `${p.xPct}%`, top: `${p.yPct}%`, transform: 'translate(-50%, -50%)' }}
                />
              ))}

            {/* Line / area modes draw no dot per weigh-in (dozens overlap into a blob) - only the touched point. */}
            {!showAllDots && highlighted && (
              <div
                className="pointer-events-none absolute h-3 w-3 rounded-full border-2 border-zinc-50 dark:border-zinc-950 bg-lime-400 shadow-glow"
                style={{ left: `${highlighted.xPct}%`, top: `${highlighted.yPct}%`, transform: 'translate(-50%, -50%)' }}
              />
            )}

            {active && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 px-3 py-1.5 text-center text-xs shadow-xl backdrop-blur"
                style={{ left: `${clampedTooltipLeft}%`, top: `${active.yPct}%` }}
              >
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{active.weightKg} ק״ג</p>
                <p className="text-zinc-600 dark:text-zinc-500">{formatDateDisplay(active.date)}</p>
              </div>
            )}
          </div>

          <div className="relative mt-1.5 h-3 text-[10px] text-zinc-500 dark:text-zinc-600">
            {points.map((p, i) =>
              labelIndices.has(i) ? (
                <span
                  key={p.date}
                  className={`absolute tabular-nums ${i === 0 && points.length > 1 ? '' : i === points.length - 1 && points.length > 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
                  style={{ left: `${p.xPct}%` }}
                >
                  {formatDateDisplay(p.date)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
