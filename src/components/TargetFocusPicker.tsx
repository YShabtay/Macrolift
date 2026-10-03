import type { TargetFocus } from '../types/fitness';

const TARGET_FOCUS_OPTIONS: { value: TargetFocus; label: string; hint: string }[] = [
  { value: 'balanced', label: 'מאוזן לכל הגוף (Balanced)', hint: 'חלוקה שווה לפי עקרונות ההיפרטרופיה - ברירת המחדל' },
  { value: 'lower_body', label: 'דגש פלג גוף תחתון וישבן (Glutes & Legs Focus)', hint: 'הרמת אגן, סקוואט, דדליפט רומני ומכרעים בתחילת האימון, עם נפח גבוה יותר' },
  { value: 'upper_body', label: 'דגש פלג גוף עליון וכתפיים (Upper Body Focus)', hint: 'יותר עבודת כתפיים ולחיצות, בתחילת אימוני העליון והדחיפה' },
];

interface TargetFocusPickerProps {
  value: TargetFocus;
  onChange: (value: TargetFocus) => void;
  compact?: boolean;
}

/** "מיקוד והעדפת אימון": which part of the body the generated program should prioritize. */
export default function TargetFocusPicker({ value, onChange, compact = false }: TargetFocusPickerProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-500">מיקוד והעדפת אימון</label>
      <div role="radiogroup" aria-label="מיקוד והעדפת אימון" className="flex flex-col gap-2">
        {TARGET_FOCUS_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`rounded-xl border px-3 text-right transition ${compact ? 'py-2.5' : 'py-3'} ${
                selected
                  ? 'border-lime-400/50 bg-lime-400/10'
                  : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
            >
              <span className={`block text-sm font-bold ${selected ? 'text-lime-700 dark:text-lime-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{option.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-zinc-600 dark:text-zinc-500">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
