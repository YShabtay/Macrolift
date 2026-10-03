import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { isChunkLoadError, tryRecoverFromChunkError } from '../utils/chunkRecovery';

interface SectionErrorBoundaryProps {
  /** Name of the screen, used in the console log. */
  section: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  error: Error | null;
  isRecovering: boolean;
}

/**
 * Contains a crash to one screen: the rest of the app (bottom navigation, the other tabs) keeps working and this screen
 * shows a calm explanation instead. The page's own `key` (the active tab) resets it when the user moves on and back.
 */
export default class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  state: SectionErrorBoundaryState = { error: null, isRecovering: false };

  static getDerivedStateFromError(error: unknown): Partial<SectionErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)), isRecovering: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`MacroLift: "${this.props.section}" failed to render:`, error, info.componentStack);
    // A stale-chunk error (the app was updated underneath this tab) is fixed by one silent reload, not by an error card.
    this.setState({ isRecovering: isChunkLoadError(error) && tryRecoverFromChunkError() });
  }

  render() {
    const { error, isRecovering } = this.state;
    if (!error) return this.props.children;
    if (isRecovering) return <p className="py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">מעדכן לגרסה החדשה...</p>;

    return (
      <div role="alert" className="glass-card flex flex-col items-center gap-3 p-6 text-center animate-fade-in">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-400/10 text-lime-700 dark:text-lime-400">
          <Lock className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-bold text-zinc-900 dark:text-zinc-100">חלה שגיאה בטעינת חלק זה</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">הנתונים שלך בטוחים 🔒 אפשר להמשיך להשתמש בשאר האפליקציה.</p>
        </div>
        <button type="button" onClick={() => this.setState({ error: null, isRecovering: false })} className="btn-secondary text-sm">
          נסו שוב
        </button>
        <p dir="ltr" className="max-w-full break-words text-[10px] text-zinc-500">
          {this.props.section}: {error.message}
        </p>
      </div>
    );
  }
}
