import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Dumbbell, LogOut, Moon, Pin, PinOff, RotateCcw, Sun } from 'lucide-react';
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

const ROW =
  'flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-[1.0625rem] py-3 text-right font-medium transition-colors';

/**
 * Desktop navigation rail: icons only by default, opening (and pushing the page aside) while the pointer or keyboard focus is on it.
 * The pin button keeps it open; the choice is remembered on this device.
 */
export default function DesktopSidebar<T extends string>({ items, active, homeId, onSelect, onReset, onLogout }: DesktopSidebarProps<T>) {
  const [pinned, setPinned] = useState(readPinned);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const expanded = pinned || hovered || focused;

  // A short delay both ways: sweeping the pointer across the edge doesn't pop the rail open, and slipping out of it doesn't snap it shut.
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
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
      {/* Takes the rail's place in the layout: the page makes room whenever the sidebar is open, so it never covers the content. */}
      <div aria-hidden className={`hidden shrink-0 transition-[width] duration-200 md:block ${expanded ? 'w-64' : 'w-[4.5rem]'}`} />

      <aside
        aria-label="ניווט ראשי"
        onMouseEnter={() => setHoverSoon(true)}
        onMouseLeave={() => setHoverSoon(false)}
        onFocusCapture={(e) => {
          // Only keyboard focus keeps the rail open: a mouse click leaves the button focused, which would otherwise hold it open like a pin.
          if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) setFocused(true);
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        className={`fixed inset-y-0 right-0 z-40 hidden flex-col overflow-hidden border-l border-zinc-200 bg-zinc-50/95 p-3 backdrop-blur-xl transition-[width] duration-200 dark:border-zinc-800 dark:bg-zinc-950/95 md:flex ${
          expanded ? 'w-64' : 'w-[4.5rem]'
        }`}
      >
        <div className="mb-8 mt-1 flex items-center gap-2.5 px-[0.5625rem]">
          <button
            type="button"
            onClick={() => onSelect(homeId)}
            aria-label="MacroLift - למסך הבית"
            title="למסך הבית"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-right"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lime-400 text-zinc-950">
              <Dumbbell className="h-5 w-5" strokeWidth={2.5} />
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
              onClick={() => onSelect(id)}
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
            onClick={toggleTheme}
            title={isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
            aria-label={isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
            className={`${ROW} text-zinc-600 hover:bg-white hover:text-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-200`}
          >
            {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
            {label(isDark ? 'מצב בהיר' : 'מצב כהה')}
          </button>
          <button type="button" onClick={onReset} title="התחלה מחדש" aria-label="התחלה מחדש" className={`${ROW} text-zinc-600 hover:bg-white hover:text-red-400 dark:text-zinc-500 dark:hover:bg-zinc-900`}>
            <RotateCcw className="h-5 w-5 shrink-0" />
            {label('התחלה מחדש')}
          </button>
          <button type="button" onClick={onLogout} title="התנתקות" aria-label="התנתקות" className={`${ROW} text-zinc-600 hover:bg-white hover:text-red-400 dark:text-zinc-500 dark:hover:bg-zinc-900`}>
            <LogOut className="h-5 w-5 shrink-0" />
            {label('התנתקות')}
          </button>
        </div>
      </aside>
    </>
  );
}
