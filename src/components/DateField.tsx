import { formatDateLong } from '../utils/weightCalculations';

interface DateFieldProps {
  /** ISO date, YYYY-MM-DD. */
  value: string;
  onChange: (value: string) => void;
  max?: string;
  min?: string;
  ariaLabel?: string;
  /** Classes for the visible field box (border, padding, text size). */
  className?: string;
  /** Classes for the outer element, e.g. flex sizing. */
  wrapperClassName?: string;
}

/**
 * Date picker that always shows a clean Hebrew date ("2 באוקטובר 2026"). A native <input type="date"> renders in
 * the device's locale and, inside an RTL page, scrambles into things like "Oct 2026 2"; here the native input is kept
 * (so the OS picker, validation and keyboard support all still work) but made invisible on top of a Hebrew label.
 */
export default function DateField({ value, onChange, max, min, ariaLabel, className = '', wrapperClassName = '' }: DateFieldProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <div
        dir="rtl"
        className={`flex items-center text-right transition focus-within:border-lime-400 focus-within:ring-2 focus-within:ring-lime-400/20 ${className}`}
      >
        {value ? formatDateLong(value) : 'בחירת תאריך'}
      </div>
      <input
        type="date"
        value={value}
        max={max}
        min={min}
        aria-label={ariaLabel ?? 'תאריך'}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // showPicker needs a user gesture / isn't supported everywhere; the native control still opens on tap.
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
