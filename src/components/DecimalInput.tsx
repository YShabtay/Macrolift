import type { InputHTMLAttributes } from 'react';
import { sanitizeDecimalText } from '../utils/decimalInput';

type DecimalInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'inputMode'> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Number field that gives iPhone the decimal keypad (with a "." key) without the quirks of type="number" - Safari wipes a
 * half-typed "1." or "1,", and locales with a comma separator reject the dot. It is a text field that only accepts digits and one
 * dot, converting a typed comma to a dot, so the stored text always works with Number().
 * Forced LTR so a trailing dot isn't drawn on the wrong side of the digits inside the RTL page.
 */
export default function DecimalInput({ value, onValueChange, ...rest }: DecimalInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      dir="ltr"
      value={value}
      onChange={(e) => onValueChange(sanitizeDecimalText(e.target.value))}
    />
  );
}
