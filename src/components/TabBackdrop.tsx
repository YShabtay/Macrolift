interface TabBackdropProps {
  src: string;
  /** CSS object-position that keeps the subject in frame (the vertical part matters on wide screens, where the photo is cropped top and bottom). */
  focus?: string;
  /** The shorter backdrop used by tabs that only have a title. */
  compact?: boolean;
}

/**
 * The photo that is the background of the top of a screen: it spans the full width of the page area (edge to edge, up under the status bar),
 * has no frame or rounded corners, and dissolves into the page colour below, so the title and the cards simply sit on it. It scrolls away with the page.
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
      {/* The picture sits a little lower on phones with a camera cutout (safe-area inset; 0 elsewhere), so a head is never behind the island.
          The small strip that opens up at the top is filled with a mirrored copy of the photo's own top edge: sharp and the same colours. */}
      <div className="absolute inset-x-0 bottom-0" style={{ top: 'calc(env(safe-area-inset-top) * 0.55)' }}>
        <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: focus }} />
        <img
          src={src}
          alt=""
          className="absolute left-0 h-full w-full -scale-y-100 object-cover"
          // 1px overlap with the sharp picture, so no hairline shows at the seam.
          style={{ objectPosition: focus, bottom: 'calc(100% - 1px)' }}
        />
      </div>
      {/* Darkens the lower part, behind the text, so white text stays readable on a bright photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 from-20% via-black/40 via-60% to-transparent" />
    </div>
  );
}
