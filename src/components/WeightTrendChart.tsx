import { useMemo, useRef, useState } from 'react';
import type { WeightLog } from '../types/fitness';
import { daysBetween, formatDateDisplay, todayIso } from '../utils/weightCalculations';

interface WeightTrendChartProps {
  logs: WeightLog[];
}

type RangeId = '30' | '90' | 'all';

const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: '30', label: 'חודש', days: 30 },
  { id: '90', label: '3 חודשים', days: 90 },
  { id: 'all', label: 'הכל', days: null },
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

export default function WeightTrendChart({ logs }: WeightTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [range, setRange] = useState<RangeId>('all');

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

  const rangePills = (
    <div dir="rtl" className="mb-3 flex justify-center gap-1.5">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => {
            setRange(r.id);
            setActiveIndex(null);
          }}
          aria-pressed={range === r.id}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
            range === r.id
              ? 'border-lime-400/60 bg-lime-400/10 text-lime-700 dark:text-lime-400'
              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (points.length === 0) {
    return (
      <div>
        {logs.length > 0 && rangePills}
        <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/30 dark:bg-zinc-900/30 text-sm text-zinc-600 dark:text-zinc-500">
          {logs.length > 0 ? 'אין שקילות בטווח הזמן שנבחר' : 'אין עדיין מספיק נתונים להצגת גרף'}
        </div>
      </div>
    );
  }

  const tickYPct = (value: number) => 100 - ((value - yMin) / (yMax - yMin || 1)) * 100;

  const linePath = buildSmoothPath(points);
  const areaPath = points.length > 1 ? `${linePath} L ${points[points.length - 1].xPct},100 L ${points[0].xPct},100 Z` : '';

  const active = activeIndex !== null ? points[activeIndex] : null;
  const clampedTooltipLeft = active ? Math.min(Math.max(active.xPct, 14), 86) : 0;

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
      {rangePills}
      {/* Equal 16px gutters on both sides keep the plot centered in the card; the y-axis column sits inside them. */}
      <div dir="ltr" className="mx-auto flex w-full flex-col px-4">
      <div className="flex gap-2">
        <div className="relative h-48 w-8 shrink-0 text-[10px] text-zinc-500 dark:text-zinc-600">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 tabular-nums"
              style={{ top: `${tickYPct(t)}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        <div
          ref={containerRef}
          className="relative h-48 flex-1 cursor-crosshair"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="weightAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a3e635" stopOpacity="0.28" />
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

            {areaPath && <path d={areaPath} fill="url(#weightAreaGradient)" stroke="none" />}

            {points.length > 1 && (
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

          {/* No dot per weigh-in (dozens overlap into a blob) - only the hovered/touched point, or the lone point of a one-entry history. */}
          {(active ?? (points.length === 1 ? points[0] : null)) && (
            <div
              className="pointer-events-none absolute h-3 w-3 rounded-full border-2 border-zinc-950 bg-lime-400 shadow-glow"
              style={{
                left: `${(active ?? points[0]).xPct}%`,
                top: `${(active ?? points[0]).yPct}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}

          {active && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 px-3 py-1.5 text-center text-xs shadow-xl backdrop-blur"
              style={{ left: `${clampedTooltipLeft}%`, top: `${active.yPct}%` }}
            >
              <p className="font-bold text-zinc-900 dark:text-zinc-100">{active.weightKg} ק״ג</p>
              <p className="text-zinc-600 dark:text-zinc-500">{formatDateDisplay(active.date)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="ml-10 mt-1.5 flex text-[10px] text-zinc-500 dark:text-zinc-600">
        <div className="relative h-3 flex-1">
          {points.map((p, i) =>
            labelIndices.has(i) ? (
              <span
                key={p.date}
                className="absolute -translate-x-1/2 tabular-nums"
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
