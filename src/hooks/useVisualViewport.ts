import { useEffect, useState } from 'react';

export interface VisualViewportBox {
  top: number;
  height: number;
  /** True while a software keyboard covers a large part of the screen. */
  keyboardOpen: boolean;
}

/**
 * The part of the screen that is actually visible (above the on-screen keyboard). iOS Safari doesn't resize `position: fixed` layouts for the
 * keyboard - it scrolls the page instead, so a full-screen sheet slides up and shows the app underneath. A sheet sized and positioned to this
 * box stays glued to the visible area. Returns null when inactive or unsupported (the sheet then falls back to plain `inset-0`).
 */
export function useVisualViewport(active: boolean): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;

    const update = () => setBox({ top: vv.offsetTop, height: vv.height, keyboardOpen: window.innerHeight - vv.height > 120 });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setBox(null);
    };
  }, [active]);

  return box;
}
