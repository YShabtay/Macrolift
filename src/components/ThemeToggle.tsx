import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/** Icon-only toggle for the sidebar / mobile top bar. */
export function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 transition hover:border-lime-400/50 hover:text-lime-700 dark:hover:text-lime-400 ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/** Labeled light/dark switch for the Settings screen. */
export function ThemeToggleSetting() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="glass-card flex items-center justify-between gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/10 text-lime-700 dark:text-lime-400">
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </span>
        <div>
          <p className="font-bold text-zinc-900 dark:text-zinc-100">מצב תצוגה</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-500">{isDark ? 'מצב כהה פעיל' : 'מצב בהיר פעיל'}</p>
        </div>
      </div>
      <div className="flex overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => isDark && toggleTheme()}
          aria-pressed={!isDark}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition ${
            !isDark ? 'bg-lime-400 text-zinc-950' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Sun className="h-3.5 w-3.5" />
          בהיר
        </button>
        <button
          type="button"
          onClick={() => !isDark && toggleTheme()}
          aria-pressed={isDark}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition ${
            isDark ? 'bg-lime-400 text-zinc-950' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Moon className="h-3.5 w-3.5" />
          כהה
        </button>
      </div>
    </div>
  );
}
