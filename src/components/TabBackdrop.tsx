interface TabBackdropProps {
  src: string;
  /** CSS object-position that keeps the subject in frame. */
  focus?: string;
  /** The shorter backdrop used by tabs that only have a title. */
  compact?: boolean;
}

/**
 * The photo that is the background of the top of a screen: it spans the full width of the page area (edge to edge, up under the status bar),
 * has no frame, and dissolves into the page colour below, so the title and the cards simply sit on it. It scrolls away with the page.
 */
export default function TabBackdrop({ src, focus = '50% 28%', compact = false }: TabBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden ${
        compact ? 'h-[calc(340px+env(safe-area-inset-top))] md:h-[430px]' : 'h-[calc(420px+env(safe-area-inset-top))] md:h-[560px]'
      }`}
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, #000 58%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, #000 58%, transparent 100%)',
      }}
    >
      {/* A blurred copy fills everything, including the strip behind the status bar / camera cutout, so the photo's colours run to the very top. */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl" />
      {/* The sharp picture starts below the cutout (safe-area inset; 0 on devices without one) so a head is never hidden behind the island. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: 'env(safe-area-inset-top)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 calc(env(safe-area-inset-top) * 0.5 + 1px))',
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 calc(env(safe-area-inset-top) * 0.5 + 1px))',
        }}
      >
        <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: focus }} />
      </div>
      {/* Darkens the lower part, behind the text, so white text stays readable on a bright photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 from-20% via-black/40 via-60% to-transparent" />
    </div>
  );
}
