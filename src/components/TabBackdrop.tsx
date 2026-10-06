interface TabBackdropProps {
  src: string;
  /** CSS object-position that keeps the subject in frame. The horizontal part also decides where on a phone the subject sits relative to the camera cutout. */
  focus?: string;
  /** The shorter backdrop used by tabs that only have a title. */
  compact?: boolean;
}

/**
 * The photo that is the background of the top of a screen: it spans the full width of the page area (edge to edge, up under the status bar),
 * has no frame or rounded corners, and sits behind the title and the cards. It scrolls away with the page.
 * Phone: the picture dissolves into the page colour at the bottom.
 * Desktop: the picture ends in a clean edge and continues for a moment as a faint mirror reflection that fades out, like a glossy floor.
 */
export default function TabBackdrop({ src, focus = '50% 18%', compact = false }: TabBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden ${
        compact ? 'h-[calc(340px+env(safe-area-inset-top))] md:h-[clamp(400px,34vw,600px)]' : 'h-[calc(420px+env(safe-area-inset-top))] md:h-[clamp(520px,44vw,780px)]'
      }`}
    >
      {/* The photo. On phones it fills the whole backdrop and fades out at the bottom; on desktop it takes the upper 78% and the reflection the rest. */}
      <div
        className="absolute inset-x-0 top-0 bottom-0 max-md:[-webkit-mask-image:linear-gradient(to_bottom,#000_58%,transparent_100%)] max-md:[mask-image:linear-gradient(to_bottom,#000_58%,transparent_100%)] md:bottom-[22%]"
      >
        <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: focus }} />
        {/* Darkens the lower part, behind the text, so white text stays readable on a bright photo (lighter on desktop, where nothing needs to fade into black). */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 from-20% via-black/40 via-60% to-transparent md:from-black/55 md:via-black/15 md:via-60%" />
      </div>

      {/* Desktop only: the reflection - the photo's bottom edge mirrored, slightly soft, fading to nothing. */}
      <div
        className="absolute inset-x-0 bottom-0 hidden h-[22%] overflow-hidden md:block"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 85%)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 85%)',
        }}
      >
        <div className="absolute inset-x-0 top-0 -scale-y-100" style={{ height: '354.5%' }}>
          <img src={src} alt="" className="h-full w-full object-cover blur-[2px]" style={{ objectPosition: focus }} />
        </div>
      </div>
    </div>
  );
}
