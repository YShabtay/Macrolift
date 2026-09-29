import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render/lifecycle errors anywhere below it and shows a friendly fallback
 * instead of an unstyled crash/blank screen. LocalStorage data is untouched by a
 * render crash, so a reload is always enough to recover.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MacroLift crashed:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-zinc-950 p-6 text-center text-zinc-900 dark:text-zinc-100">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-400/10 text-orange-700 dark:text-orange-400">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <div>
          <h1 className="mb-1 font-bold">משהו השתבש</h1>
          <p className="max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-500">
            קרתה תקלה בלתי צפויה. הנתונים שלך שמורים באופן מקומי ולא נפגעו - נסו לטעון את האפליקציה מחדש.
          </p>
        </div>
        <button type="button" onClick={this.handleReload} className="btn-primary">
          <RotateCcw className="h-4 w-4" />
          טעינה מחדש
        </button>
      </div>
    );
  }
}
