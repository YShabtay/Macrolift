import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface TourStep {
  id: string;
  /** Screen (tab) that has to be showing for the target to exist; the tour switches to it before looking for the target. */
  tab?: string;
  /** Value of the target element's `data-tour` attribute. Omit for a centered message with no spotlight. */
  target?: string;
  title: string;
  body: string;
}

interface GuidedTourProps {
  steps: TourStep[];
  onNavigate: (tab: string) => void;
  /** Called when the tour ends, by finishing the last step or skipping. */
  onClose: () => void;
}

interface Layout {
  rect: { top: number; left: number; width: number; height: number } | null;
  popoverHeight: number;
}

const SPOTLIGHT_PADDING = 8;
const POPOVER_GAP = 12;
const EDGE_MARGIN = 12;
const FIND_ATTEMPTS = 40;
const FIND_INTERVAL_MS = 50;

/**
 * Dependency-free step-by-step tour: dims the screen, cuts a spotlight around each step's target element,
 * and shows an RTL explanation bubble with Next / Previous / Skip. Steps may live on different tabs - the
 * tour switches to the right one and waits for the target to render. A step whose target can't be found
 * still shows its message (centered), so a missing element never blocks the tour.
 */
export default function GuidedTour({ steps, onNavigate, onClose }: GuidedTourProps) {
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout>({ rect: null, popoverHeight: 200 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigateRef = useRef(onNavigate);
  const closeRef = useRef(onClose);

  useEffect(() => {
    navigateRef.current = onNavigate;
    closeRef.current = onClose;
  });

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Locate the step's target and keep the spotlight glued to it (it moves while scrolling / on layout changes).
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    function track(el: Element) {
      const update = () => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        const popoverHeight = popoverRef.current?.offsetHeight ?? 200;
        setLayout((prev) => {
          const same =
            prev.rect &&
            Math.abs(prev.rect.top - r.top) < 0.5 &&
            Math.abs(prev.rect.left - r.left) < 0.5 &&
            Math.abs(prev.rect.width - r.width) < 0.5 &&
            Math.abs(prev.rect.height - r.height) < 0.5 &&
            prev.popoverHeight === popoverHeight;
          return same ? prev : { rect: { top: r.top, left: r.left, width: r.width, height: r.height }, popoverHeight };
        });
        frame = requestAnimationFrame(update);
      };
      update();
    }

    function find() {
      if (cancelled) return;
      if (!step.target) {
        setLayout((prev) => ({ ...prev, rect: null }));
        return;
      }
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        track(el);
      } else if (attempts++ < FIND_ATTEMPTS) {
        timer = setTimeout(find, FIND_INTERVAL_MS);
      } else {
        setLayout((prev) => ({ ...prev, rect: null }));
      }
    }

    if (step.tab) navigateRef.current(step.tab);
    // Deferred so the tab switch above has rendered before the first lookup.
    timer = setTimeout(find, 0);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [step]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function goNext() {
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  }

  function goPrevious() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const popoverWidth = Math.min(352, viewportWidth - EDGE_MARGIN * 2);
  const { rect, popoverHeight } = layout;

  let popoverStyle: React.CSSProperties;
  if (!rect) {
    popoverStyle = { top: '50%', left: '50%', width: popoverWidth, transform: 'translate(-50%, -50%)' };
  } else {
    const spaceBelow = viewportHeight - (rect.top + rect.height + SPOTLIGHT_PADDING) - POPOVER_GAP - EDGE_MARGIN;
    const spaceAbove = rect.top - SPOTLIGHT_PADDING - POPOVER_GAP - EDGE_MARGIN;
    let top: number;
    if (popoverHeight <= spaceBelow) top = rect.top + rect.height + SPOTLIGHT_PADDING + POPOVER_GAP;
    else if (popoverHeight <= spaceAbove) top = rect.top - SPOTLIGHT_PADDING - POPOVER_GAP - popoverHeight;
    else top = viewportHeight - popoverHeight - EDGE_MARGIN; // target too large to avoid: float over its lower part
    top = Math.max(top, 56);
    const centerX = rect.left + rect.width / 2;
    const left = Math.min(Math.max(centerX - popoverWidth / 2, EDGE_MARGIN), viewportWidth - popoverWidth - EDGE_MARGIN);
    popoverStyle = { top, left, width: popoverWidth };
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="סיור מודרך באפליקציה" dir="rtl">
      {/* Full-screen catcher: dims everything when there's no spotlight, and blocks taps on the page underneath. */}
      <div className={`absolute inset-0 ${rect ? '' : 'bg-zinc-950/75 backdrop-blur-[1px]'}`} />

      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl ring-2 ring-lime-400 transition-all duration-200"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(9, 9, 11, 0.78)',
          }}
        />
      )}

      <div
        ref={popoverRef}
        key={step.id}
        className="absolute flex flex-col gap-3 rounded-2xl border border-lime-400/40 bg-white dark:bg-zinc-900 p-4 shadow-2xl animate-fade-in"
        style={popoverStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-extrabold leading-snug text-zinc-900 dark:text-zinc-100">{step.title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירת הסיור"
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{step.body}</p>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-lime-400' : 'w-1.5 bg-zinc-300 dark:bg-zinc-700'}`} />
          ))}
          <span dir="rtl" className="mr-auto text-[11px] font-semibold text-zinc-500">
            שלב {index + 1} מתוך {steps.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={goNext} className="btn-primary px-4 py-2.5 text-sm">
            {isLast ? 'סיום' : 'הבא'}
            {!isLast && <ChevronLeft className="h-4 w-4" />}
          </button>
          {index > 0 && (
            <button type="button" onClick={goPrevious} className="btn-secondary px-3 py-2.5 text-sm">
              <ChevronRight className="h-4 w-4" />
              הקודם
            </button>
          )}
          {!isLast && (
            <button type="button" onClick={onClose} className="mr-auto text-xs font-semibold text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200">
              דלג
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
