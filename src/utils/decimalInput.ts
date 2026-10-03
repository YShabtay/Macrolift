/**
 * Cleans text typed into a decimal field: comma (and the Arabic decimal separator) becomes a dot, everything except digits and
 * a single dot is dropped. A trailing dot is kept on purpose ("1." is a number in progress, not a mistake), as is a leading one.
 */
export function sanitizeDecimalText(raw: string): string {
  const dotted = raw.replace(/[,٫]/g, '.').replace(/[^0-9.]/g, '');
  const firstDot = dotted.indexOf('.');
  if (firstDot === -1) return dotted;
  return dotted.slice(0, firstDot + 1) + dotted.slice(firstDot + 1).replace(/\./g, '');
}

/** The number a decimal field holds, or null when it is empty or only a dot. */
export function parseDecimal(text: string): number | null {
  const n = Number(sanitizeDecimalText(text));
  return /\d/.test(text) && Number.isFinite(n) ? n : null;
}
