interface TabBackdropProps {
  src: string;
  /** CSS object-position that keeps the subject in frame. The horizontal part also decides where on a phone the subject sits relative to the camera cutout. */
  focus?: string;
  /** The shorter backdrop used by tabs that only have a title. */
  compact?: boolean;
}

/**
 * The photo that is the background of the top of a screen: it spans the full width of the page area (edge to edge, up under the status bar),
 * has no frame or rounded corners, and dissolves into the page colour below, so the title and the cards simply sit on it. It scrolls away with the page.
 * On desktop the lower part is also softly blurred, so the picture melts into the page instead of just fading.
 */
export default function TabBackdrop({ src, focus = '50% 18%', compact = false }: TabBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden ${
        compact ? 'h-[calc(340px+env(safe-area-inset-top))] md:h-[clamp(380px,32vw,560px)]' : 'h-[calc(420px+env(safe-area-inset-top))] md:h-[clamp(480px,40vw,720px)]'
      }`}
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, #000 58%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, #000 58%, transparent 100%)',
      }}
    >
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: focus }} />
      {/* Desktop: a blurred copy of the same picture, faded in from the middle down - the lower part goes soft, like depth of field. */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 hidden h-full w-full scale-110 object-cover blur-xl md:block"
        style={{
          objectPosition: focus,
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 30%, #000 80%)',
          maskImage: 'linear-gradient(to bottom, transparent 30%, #000 80%)',
        }}
      />
      {/* Darkens the lower part, behind the text, so white text stays readable on a bright photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 from-20% via-black/40 via-60% to-transparent" />
    </div>
  );
}
