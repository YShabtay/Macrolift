interface TabBackdropProps {
  src: string;
  /** CSS object-position that keeps the subject in frame. The horizontal part also decides where on a phone the subject sits relative to the camera cutout. */
  focus?: string;
  /** The shorter backdrop used by tabs that only have a title. */
  compact?: boolean;
}

/**
 * The photo that is the background of the top of a screen: it spans the full width of the page area (edge to edge, up under the status bar),
 * has no frame or rounded corners, and dissolves into the page colour at the bottom, so the title and the cards simply sit on it.
 * It scrolls away with the page.
 */
export default function TabBackdrop({ src, focus = '50% 18%', compact = false }: TabBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 animate-fade-in overflow-hidden motion-reduce:animate-none max-md:[-webkit-mask-image:linear-gradient(to_bottom,#000_58%,transparent_100%)] max-md:[mask-image:linear-gradient(to_bottom,#000_58%,transparent_100%)] md:[-webkit-mask-image:linear-gradient(to_bottom,#000_36%,transparent_90%)] md:[mask-image:linear-gradient(to_bottom,#000_36%,transparent_90%)] ${
        compact ? 'h-[calc(340px+env(safe-area-inset-top))] md:h-[clamp(460px,40vw,680px)]' : 'h-[calc(420px+env(safe-area-inset-top))] md:h-[clamp(560px,48vw,820px)]'
      }`}
    >
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: focus }} />
      {/* Keeps white text readable on a bright photo (lighter on desktop, where the photo is larger and the text sits lower). */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 from-20% via-black/40 via-60% to-transparent md:from-black/55 md:via-black/20" />
    </div>
  );
}
