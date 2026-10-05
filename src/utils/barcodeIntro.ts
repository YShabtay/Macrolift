const BARCODE_INTRO_SEEN_KEY = 'macrolift-barcode-intro-seen';

/** Whether the one-time note about the barcode database (not every product is in it; typed-in values are remembered) was already shown. */
export function hasSeenBarcodeIntro(): boolean {
  try {
    return localStorage.getItem(BARCODE_INTRO_SEEN_KEY) === '1';
  } catch {
    return true; // Can't remember the choice, so don't risk showing it on every scan.
  }
}

export function markBarcodeIntroSeen(): void {
  try {
    localStorage.setItem(BARCODE_INTRO_SEEN_KEY, '1');
  } catch {
    // Storage blocked: nothing to persist.
  }
}
