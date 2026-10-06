export interface HeroSlide {
  id: string;
  eyebrow: string;
  headline: string;
  body?: string;
  tags?: string[];
  /** Omit both to render a plain headline with no call-to-action (a tab's title). */
  ctaLabel?: string;
  onCta?: () => void;
}

/**
 * The title block at the top of a screen. It carries no picture of its own: the photo is the screen's background (see TabBackdrop), so this is
 * only the text and the call-to-action sitting on top of it. It starts at the very top of the page (cancelling the page's top padding) so the text
 * lines up with the photo, and is tall enough to leave the upper part of the picture clear for the subject.
 */
export default function HeroCarousel({ slides, compact = false }: { slides: HeroSlide[]; compact?: boolean }) {
  const slide = slides[0];
  if (!slide) return null;

  return (
    <div
      className={`relative -mt-[max(calc(env(safe-area-inset-top)+1rem),3rem)] flex flex-col justify-end gap-2 pb-2 md:mt-0 ${
        compact ? 'min-h-[calc(220px+env(safe-area-inset-top))] md:min-h-[270px]' : 'min-h-[calc(300px+env(safe-area-inset-top))] md:min-h-[390px]'
      }`}
    >
      <div>
        <p className={`font-bold uppercase tracking-wider text-lime-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>{slide.eyebrow}</p>
        <h2
          className={`font-extrabold tracking-tight text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.55)] ${
            compact ? 'mt-0.5 text-lg sm:text-xl' : 'mt-1 text-xl sm:text-2xl'
          }`}
        >
          {slide.headline}
        </h2>
      </div>

      {slide.body && <p className={`max-w-md leading-relaxed text-zinc-200 ${compact ? 'text-xs' : 'text-sm'}`}>{slide.body}</p>}

      {slide.tags && slide.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {slide.tags.map((tag) => (
            <span key={tag} className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
              {tag}
            </span>
          ))}
        </div>
      )}

      {slide.ctaLabel && slide.onCta && (
        <button type="button" onClick={slide.onCta} className="btn-primary mt-1 self-start shadow-glow">
          {slide.ctaLabel}
        </button>
      )}
    </div>
  );
}
