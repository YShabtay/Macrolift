import type { ReactNode } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}

/**
 * Wraps the app with a pull-to-refresh gesture. The page is pushed down by an in-flow spacer (not a CSS transform:
 * a transform on an ancestor would turn every `position: fixed` descendant - bottom nav, floating buttons - into
 * absolutely-positioned ones). The indicator is fixed below the iPhone's status bar / Dynamic Island.
 */
export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { pull, progress, isPulling, isRefreshing } = usePullToRefresh({ onRefresh });
  const isReady = progress >= 1;

  return (
    <>
      <div
        aria-hidden="true"
        style={{ height: pull, transition: isPulling ? 'none' : 'height 0.3s ease-out' }}
      />

      <div
        role="status"
        aria-live="polite"
        aria-label={isRefreshing ? 'מרענן...' : undefined}
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
        style={{
          top: 'calc(env(safe-area-inset-top) + 0.5rem)',
          opacity: isRefreshing ? 1 : Math.min(pull / 28, 1),
          transform: `translateY(${isRefreshing ? 0 : -8 + progress * 8}px) scale(${isRefreshing ? 1 : 0.7 + progress * 0.3})`,
          transition: isPulling ? 'none' : 'opacity 0.3s ease-out, transform 0.3s ease-out',
        }}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-lg dark:bg-zinc-900 ${
            isReady || isRefreshing ? 'border-lime-400/70 shadow-glow' : 'border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-lime-600 dark:text-lime-400" />
          ) : (
            <ArrowDown
              className={`h-5 w-5 ${isReady ? 'text-lime-600 dark:text-lime-400' : 'text-zinc-500'}`}
              style={{ transform: `rotate(${progress * 180}deg)`, transition: isPulling ? 'none' : 'transform 0.2s ease-out' }}
            />
          )}
        </span>
      </div>

      {children}
    </>
  );
}
