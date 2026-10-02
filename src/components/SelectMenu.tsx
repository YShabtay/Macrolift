import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string> {
  id: T;
  label: string;
}

interface SelectMenuProps<T extends string> {
  /** Accessible name for the trigger, e.g. "טווח זמן". */
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}

/** Compact dropdown: a pill showing the current choice that opens a small list. Closes on outside tap, Escape or selection. */
export default function SelectMenu<T extends string>({ label, value, options, onChange }: SelectMenuProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${
          isOpen
            ? 'border-lime-400/60 bg-lime-400/10 text-lime-700 dark:text-lime-400'
            : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-lime-400/50'
        }`}
      >
        {current?.label}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-1.5 min-w-[9rem] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 shadow-xl animate-fade-in"
        >
          {options.map((o) => (
            <li key={o.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                onClick={() => {
                  onChange(o.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-right text-xs font-semibold transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  o.id === value ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {o.label}
                {o.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
