import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Lock } from 'lucide-react';

interface SectionErrorBoundaryProps {
  /** Name of the screen, used in the console log. */
  section: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  error: Error | null;
}

/**
 * Contains a crash to one screen: the rest of the app (bottom navigation, the other tabs) keeps working and this screen
 * shows a calm explanation instead. The page's own `key` (the active tab) resets it when the user moves on and back.
 */
export default class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  state: SectionErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): SectionErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`MacroLift: "${this.props.section}" failed to render:`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="glass-card flex flex-col items-center gap-3 p-6 text-center animate-fade-in">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
          <Lock className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">חלה שגיאה בטעינת חלק זה</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">הנתונים שלך בטוחים 🔒 אפשר להמשיך להשתמש בשאר האפליקציה.</p>
        </div>
        <button type="button" onClick={() => this.setState({ error: null })} className="btn-secondary text-sm">
          נסו שוב
        </button>
        <p dir="ltr" className="max-w-full break-words text-[10px] text-zinc-500">
          {this.props.section}: {error.message}
        </p>
      </div>
    );
  }
}
