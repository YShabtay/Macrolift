import { useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface TabBarItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface MobileTabBarProps<T extends string> {
  items: TabBarItem<T>[];
  current: T;
  onSelect: (id: T) => void;
}

/** Inner padding of the bar in rem (0.375rem = p-1.5); the indicator math below depends on it. */
const PAD_REM = 0.375;
/** Pointer travel (px) before a touch counts as a drag along the bar instead of a tap. */
const DRAG_THRESHOLD_PX = 8;

/**
 * The floating tab bar on phones. One green pill glides (with a slight spring) to the selected tab instead of each tab flashing its own
 * background, the active icon lifts a little, and a finger can slide along the bar: the pill follows it tab by tab and the screen changes only
 * when the finger is released, so scrubbing never re-renders the page underneath.
 */
export default function MobileTabBar<T extends string>({ items, current, onSelect }: MobileTabBarProps<T>) {
  const navRef = useRef<HTMLElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startY: 0 });
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const currentIndex = Math.max(items.findIndex((i) => i.id === current), 0);
  const shownIndex = dragIndex ?? currentIndex;

  function indexAt(clientX: number): number {
    const nav = navRef.current;
    if (!nav) return currentIndex;
    const rect = nav.getBoundingClientRect();
    const pad = PAD_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);
    const itemWidth = (rect.width - pad * 2) / items.length;
    const isRtl = getComputedStyle(nav).direction === 'rtl';
    const fromStart = isRtl ? rect.right - pad - clientX : clientX - rect.left - pad;
    return Math.min(Math.max(Math.floor(fromStart / itemWidth), 0), items.length - 1);
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      try {
        navRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone (or synthetic): the drag still works from the events the bar receives.
      }
    }
    setDragIndex(indexAt(e.clientX));
  }

  function finishDrag(e: React.PointerEvent, commit: boolean) {
    const d = drag.current;
    drag.current = { active: false, moved: false, startX: 0, startY: 0 };
    if (!d.moved) return;
    setDragIndex(null);
    if (commit) {
      const target = items[indexAt(e.clientX)];
      if (target && target.id !== current) onSelect(target.id);
    }
  }

  return (
    <nav
      ref={navRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finishDrag(e, true)}
      onPointerCancel={(e) => finishDrag(e, false)}
      style={{ touchAction: 'none' }}
      className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-20 mx-auto grid max-w-md select-none rounded-full border border-white/60 bg-white/55 p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_12px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/15 dark:bg-zinc-900/45 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_12px_40px_-12px_rgba(0,0,0,0.7)] md:hidden"
      aria-label="ניווט ראשי"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1.5 rounded-full bg-lime-400 shadow-[0_6px_18px_-6px_rgba(163,230,53,0.75)] transition-[inset-inline-start] duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none"
        style={{
          insetInlineStart: `calc(${PAD_REM}rem + ${shownIndex} * ((100% - ${PAD_REM * 2}rem) / ${items.length}))`,
          width: `calc((100% - ${PAD_REM * 2}rem) / ${items.length})`,
        }}
      />
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ id, label, icon: Icon }, index) => {
          const isShown = index === shownIndex;
          return (
            <button
              key={id}
              type="button"
              onClick={() => id !== current && onSelect(id)}
              aria-current={id === current ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-full py-2 text-[10px] font-semibold transition-colors duration-300 active:scale-95 ${
                isShown ? 'text-zinc-950' : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${isShown ? '-translate-y-px scale-110' : ''}`}
                strokeWidth={isShown ? 2.5 : 2}
              />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
