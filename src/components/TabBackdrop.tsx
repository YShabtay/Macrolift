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
 * Desktop: the picture goes from sharp to softly blurred as it goes down, and that blur carries on a little below the picture, fading out into the page.
 */
export default function TabBackdrop({ src, focus = '50% 18%', compact = false }: TabBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden md:overflow-visible md:[overflow-x:clip] ${
        compact ? 'h-[calc(340px+env(safe-area-inset-top))] md:h-[clamp(380px,32vw,560px)]' : 'h-[calc(420px+env(safe-area-inset-top))] md:h-[clamp(480px,40vw,720px)]'
      }`}
    >
      {/* The sharp photo. Phone: fades out at the bottom. Desktop: fades out lower down, handing over to the blurred layer. */}
      <div className="absolute inset-0 max-md:[-webkit-mask-image:linear-gradient(to_bottom,#000_58%,transparent_100%)] max-md:[mask-image:linear-gradient(to_bottom,#000_58%,transparent_100%)] md:[-webkit-mask-image:linear-gradient(to_bottom,#000_42%,transparent_88%)] md:[mask-image:linear-gradient(to_bottom,#000_42%,transparent_88%)]">
        <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: focus }} />
        {/* Keeps white text readable on a bright photo. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 from-20% via-black/40 via-60% to-transparent md:from-black/45 md:via-black/15" />
      </div>

      {/* Desktop only: the same picture, blurred, starting around the middle and running on past the bottom of the photo into the page. */}
      <div
        className="absolute inset-x-0 top-0 -bottom-48 hidden md:block"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 28%, #000 62%, #000 74%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 28%, #000 62%, #000 74%, transparent 100%)',
        }}
      >
        <img src={src} alt="" className="h-full w-full scale-110 object-cover blur-2xl brightness-75" style={{ objectPosition: focus }} />
      </div>
    </div>
  );
}
