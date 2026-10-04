import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

const DISPLAY_MS = 3000;
const EXIT_MS = 300;

export default function Toast({ message, onDismiss }: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = setTimeout(() => setIsLeaving(true), DISPLAY_MS);
    return () => clearTimeout(leaveTimer);
  }, []);

  useEffect(() => {
    if (!isLeaving) return;
    const dismissTimer = setTimeout(onDismiss, EXIT_MS);
    return () => clearTimeout(dismissTimer);
  }, [isLeaving, onDismiss]);

  return createPortal(
    <div
      className={`pointer-events-none fixed inset-x-0 top-[calc(max(env(safe-area-inset-top),0.5rem)+0.5rem)] z-[90] flex justify-center px-4 ${isLeaving ? 'animate-toast-out' : 'animate-toast-in'}`}
    >
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-lime-400/40 bg-zinc-900 px-4 py-3 shadow-glow">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-400 text-zinc-950">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <p className="text-sm font-medium text-zinc-100">{message}</p>
      </div>
    </div>,
    document.body,
  );
}
