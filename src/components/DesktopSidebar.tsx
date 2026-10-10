import { useEffect, useRef, useState, type ComponentType } from 'react';
import { LogOut, Moon, Pin, PinOff, RotateCcw, Sun } from 'lucide-react';
import LogoMark from './LogoMark';
import { useTheme } from '../context/ThemeContext';

const PINNED_KEY = 'macrolift-sidebar-pinned';

function readPinned(): boolean {
  try {
    return localStorage.getItem(PINNED_KEY) === '1';
  } catch {
    return false;
  }
}

function writePinned(value: boolean) {
  try {
    localStorage.setItem(PINNED_KEY, value ? '1' : '0');
  } catch {
    // Storage blocked: the choice just lasts for this visit.
  }
}

interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface DesktopSidebarProps<T extends string> {
  items: NavItem<T>[];
  active: T;
  /** The screen the logo leads to (the home screen). */
  homeId: T;
  onSelect: (id: T) => void;
  onReset: () => void;
  onLogout: () => void;
}

/** How long a rail opened by touch stays open after the last touch on it, and after choosing a screen. */
const TOUCH_IDLE_MS = 6000;
const TOUCH_AFTER_CHOICE_MS = 700;
/** A drag along the rail this far (px) opens it (towards the page) or closes it (towards the edge). */
const SWIPE_DISTANCE = 24;

const ROW =
  'flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-[1.0625rem] py-3 text-right font-medium transition-colors';

/**
 * Desktop navigation rail: icons only by default, opening (and pushing the page aside) while a mouse pointer or keyboard focus is on it.
 * A finger or the Apple Pencil has no hover: touching the rail opens it over the page (a dimmed backdrop, no layout jump) and it closes by itself after a
 * pause, on a tap anywhere else, on a swipe towards the edge, or soon after choosing a screen. The pin button keeps it open; the choice is remembered on this device.
 */
export default function DesktopSidebar<T extends string>({ items, active, homeId, onSelect, onReset, onLogout }: DesktopSidebarProps<T>) {
  const [pinned, setPinned] = useState(readPinned);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touchOpen, setTouchOpen] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const pushesPage = pinned || hovered || focused;
  const expanded = pushesPage || touchOpen;

  // A short delay both ways: sweeping the pointer across the edge doesn't pop the rail open, and slipping out of it doesn't snap it shut.
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const touchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(touchTimer.current), []);
  /** Opened by touch: closes by itself after a pause. */
  function holdOpenByTouch(ms: number) {
    setTouchOpen(true);
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setTouchOpen(false), ms);
  }
  function closeTouch() {
    clearTimeout(touchTimer.current);
    setTouchOpen(false);
  }
  // Opened by touch: a tap anywhere else, or the Escape key, closes it again.
  useEffect(() => {
    if (!touchOpen) return;
    const onOutside = (e: PointerEvent) => {
      if (!asideRef.current?.contains(e.target as Node | null)) closeTouch();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTouch();
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [touchOpen]);
  /** Runs a rail action; a rail opened with a finger closes shortly after, so a choice never leaves it open (unless pinned). */
  const choose = (action: () => void) => () => {
    action();
    if (touchOpen) holdOpenByTouch(TOUCH_AFTER_CHOICE_MS);
  };
  function setHoverSoon(next: boolean) {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(next), next ? 120 : 220);
  }

  function togglePinned() {
    setPinned((p) => {
      writePinned(!p);
      return !p;
    });
  }

  const label = (text: string) => (
    <span className={`transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>{text}</span>
  );

  return (
    <>
      {/* Takes the rail's place in the layout: the page makes room while a mouse hovers it or it is pinned. Opened by touch it floats over the page instead,
          so the content does not jump under a finger. */}
      <div aria-hidden className={`hidden shrink-0 transition-[width] duration-200 md:block ${pushesPage ? 'w-64' : 'w-[4.5rem]'}`} />
      {touchOpen && !pinned && (
        <div aria-hidden className="fixed inset-0 z-30 hidden bg-zinc-950/35 backdrop-blur-[1px] animate-fade-in md:block" onPointerDown={closeTouch} />
      )}

      <aside
        ref={asideRef}
        aria-label="ניווט ראשי"
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHoverSoon(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHoverSoon(false)}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          swipeStartX.current = e.clientX;
          holdOpenByTouch(TOUCH_IDLE_MS);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' || swipeStartX.current === null) return;
          const dx = e.clientX - swipeStartX.current;
          // The rail sits on the right edge: dragging towards the page (left) opens it, towards the edge (right) closes it.
          if (dx < -SWIPE_DISTANCE) {
            swipeStartX.current = null;
            holdOpenByTouch(TOUCH_IDLE_MS);
          } else if (dx > SWIPE_DISTANCE) {
            swipeStartX.current = null;
            closeTouch();
          }
        }}
        onPointerUp={() => {
          swipeStartX.current = null;
        }}
        onPointerCancel={() => {
          swipeStartX.current = null;
        }}
        onFocusCapture={(e) => {
          // Only keyboard focus keeps the rail open: a mouse click leaves the button focused, which would otherwise hold it open like a pin.
          if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) setFocused(true);
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        className={`fixed inset-y-0 right-0 z-40 hidden touch-none flex-col overflow-hidden border-l border-zinc-200 bg-zinc-50/95 p-3 backdrop-blur-xl transition-[width] duration-200 dark:border-zinc-800 dark:bg-zinc-950/95 md:flex ${
          expanded ? 'w-64' : 'w-[4.5rem]'
        }`}
      >
        <div className="mb-8 mt-1 flex items-center gap-2.5 px-[0.5625rem]">
          <button
            type="button"
            onClick={choose(() => onSelect(homeId))}
            aria-label="MacroLift - למסך הבית"
            title="למסך הבית"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-right"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lime-400 text-zinc-950">
              <LogoMark className="h-5 w-5" />
            </span>
            <span className={`flex-1 whitespace-nowrap text-xl font-extrabold tracking-tight transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
              MacroLift
            </span>
          </button>
          <button
            type="button"
            onClick={togglePinned}
            aria-pressed={pinned}
            aria-label={pinned ? 'שחרור הסרגל' : 'נעילת הסרגל פתוח'}
            title={pinned ? 'שחרור הסרגל' : 'נעילת הסרגל פתוח'}
            tabIndex={expanded ? 0 : -1}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
              expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
            } ${pinned ? 'bg-lime-400/10 text-lime-700 dark:text-lime-400' : 'text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'}`}
          >
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {items.map(({ id, label: text, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={choose(() => onSelect(id))}
              title={text}
              aria-label={text}
              aria-current={active === id ? 'page' : undefined}
              className={`${ROW} ${
                active === id
                  ? 'bg-lime-400/10 text-lime-700 dark:text-lime-400'
                  : 'text-zinc-600 hover:bg-white hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label(text)}
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          <button
            type="button"
            onClick={choose(toggleTheme)}
            title={isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
            aria-label={isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
            className={`${ROW} text-zinc-600 hover:bg-white hover:text-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-200`}
          >
            {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
            {label(isDark ? 'מצב בהיר' : 'מצב כהה')}
          </button>
          <button type="button" onClick={choose(onReset)} title="התחלה מחדש" aria-label="התחלה מחדש" className={`${ROW} text-zinc-600 hover:bg-white hover:text-red-400 dark:text-zinc-500 dark:hover:bg-zinc-900`}>
            <RotateCcw className="h-5 w-5 shrink-0" />
            {label('התחלה מחדש')}
          </button>
          <button type="button" onClick={choose(onLogout)} title="התנתקות" aria-label="התנתקות" className={`${ROW} text-zinc-600 hover:bg-white hover:text-red-400 dark:text-zinc-500 dark:hover:bg-zinc-900`}>
            <LogOut className="h-5 w-5 shrink-0" />
            {label('התנתקות')}
          </button>
        </div>
      </aside>
    </>
  );
}
