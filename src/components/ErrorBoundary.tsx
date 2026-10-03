import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { refreshApp, resetLocalData } from '../utils/appRecovery';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

/**
 * Catches render/lifecycle errors anywhere below it and shows a recovery screen instead of a blank page.
 * The error message and component stack are printed so a crash on a phone can be traced to the exact component.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MacroLift crashed:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  handleReset = () => {
    const confirmed = window.confirm(
      'פעולה זו תמחק את כל הנתונים השמורים במכשיר הזה (פרופיל, שקילות, תזונה, אימונים ותמונות) ולא ניתן לשחזר אותם, אלא אם יש לכם קובץ גיבוי. להמשיך?',
    );
    if (confirmed) void resetLocalData();
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        dir="rtl"
        className="flex min-h-svh flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-zinc-950 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(calc(env(safe-area-inset-top)+1rem),3rem)] text-center text-zinc-900 dark:text-zinc-100"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-400/10 text-orange-700 dark:text-orange-400">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <div>
          <h1 className="mb-1 font-bold">משהו השתבש</h1>
          <p className="max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-500">
            קרתה תקלה בלתי צפויה. אפשר לרענן את האפליקציה (הנתונים נשמרים). אם התקלה חוזרת, איפוס הנתונים המקומיים יחזיר את האפליקציה לעבוד, אבל ימחק את המידע במכשיר.
          </p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-2">
          <button type="button" onClick={() => void refreshApp()} className="btn-primary">
            רענן אפליקציה 🔄
          </button>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-xl border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-500/10"
          >
            איפוס נתונים מקומיים ⚠️
          </button>
        </div>

        <div dir="ltr" className="max-h-52 w-full max-w-md overflow-auto rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-left">
          <p className="break-words text-[11px] font-semibold text-red-600 dark:text-red-400">{error.message || String(error)}</p>
          {componentStack && (
            <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] leading-relaxed text-red-600/90 dark:text-red-400/90">{componentStack.trim()}</pre>
          )}
        </div>
      </div>
    );
  }
}
