import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeroSlide {
  id: string;
  imageUrl: string;
  eyebrow: string;
  headline: string;
  body?: string;
  tags?: string[];
  /** Omit both to render a plain photo header with no call-to-action (e.g. a tab's static hero banner). */
  /** CSS object-position for the photo, to keep its subject in frame (default: centred, a little above the middle). */
  focus?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const AUTOPLAY_MS = 4500;
const SWIPE_THRESHOLD_PX = 40;

/**
 * Auto-playing, swipeable hero carousel. Every slide renders a full-bleed photo with a
 * dark scrim (always-dark regardless of app theme, since it sits on top of rotating
 * photos rather than page background) so headline/body/CTA stay sharp on any image.
 *
 * Pass a single slide (no cta) to get a compact, static "tab hero" banner instead - the
 * prev/next arrows and pagination dots only render once there's more than one slide.
 * `compact` shrinks the banner to ~160-190px, meant for that single-slide tab-header case.
 */
export default function HeroCarousel({ slides, compact = false }: { slides: HeroSlide[]; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((i: number) => setIndex(((i % slides.length) + slides.length) % slides.length), [slides.length]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [isPaused, slides.length]);

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -SWIPE_THRESHOLD_PX) next();
    else if (delta > SWIPE_THRESHOLD_PX) prev();
    touchStartX.current = null;
    setIsPaused(false);
  }

  if (slides.length === 0) return null;

  const hasControls = slides.length > 1;

  return (
    <div
      // Phone: edge to edge and up under the status bar, no frame or glow; the picture dissolves into the page at the bottom (see the mask below), in light
      // and dark alike. Desktop (md+) keeps it inside the content column.
      className={`group relative isolate -mx-4 -mt-[max(calc(env(safe-area-inset-top)+1rem),3rem)] grid overflow-hidden sm:-mx-6 md:mx-0 md:mt-0 md:rounded-3xl ${
        compact
          ? 'min-h-[calc(230px+env(safe-area-inset-top))] sm:min-h-[270px] md:min-h-[210px]'
          : 'min-h-[calc(340px+env(safe-area-inset-top))] sm:min-h-[390px] md:min-h-[340px]'
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {slides.map((slide, i) => {
        const isActive = i === index;
        return (
          <div
            key={slide.id}
            aria-hidden={!isActive}
            className={`relative col-start-1 row-start-1 flex flex-col justify-end transition-opacity duration-700 ease-out ${
              isActive ? 'z-10 opacity-100' : 'z-0 opacity-0'
            }`}
          >
            {/* The picture and its dark scrim fade out together at the bottom, so there is no hard edge against the page colour. The text sits above that fade. */}
            <div
              className="absolute inset-0"
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%)',
              }}
            >
              <img
                src={slide.imageUrl}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
                style={{ objectPosition: slide.focus ?? '50% 42%' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 from-15% via-black/50 via-55% to-transparent" />
            </div>

            <div
              className={`relative z-10 flex flex-col gap-2 ${
                compact ? 'p-5 pb-9 sm:p-6 sm:pb-10' : `gap-2.5 p-6 pb-12 sm:p-8 sm:pb-12 ${hasControls ? 'pb-14 sm:pb-16' : ''}`
              }`}
            >
              <div>
                <p
                  className={`font-bold uppercase tracking-wider text-lime-400 ${compact ? 'text-[10px]' : 'text-xs'}`}
                >
                  {slide.eyebrow}
                </p>
                <h2
                  className={`font-extrabold tracking-tight text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.5)] ${
                    compact ? 'mt-0.5 text-lg sm:text-xl' : 'mt-1 text-xl sm:text-2xl'
                  }`}
                >
                  {slide.headline}
                </h2>
              </div>

              {slide.body && (
                <p className={`max-w-md leading-relaxed text-zinc-300 ${compact ? 'text-xs' : 'text-sm'}`}>{slide.body}</p>
              )}

              {slide.tags && slide.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {slide.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {slide.ctaLabel && slide.onCta && (
                <button
                  type="button"
                  tabIndex={isActive ? 0 : -1}
                  onClick={slide.onCta}
                  className="btn-primary mt-1 self-start shadow-glow"
                >
                  {slide.ctaLabel}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {hasControls && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="שקופית קודמת"
            className="absolute top-1/2 left-3 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-2.5 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 pointer-events-none hover:bg-black/80 group-hover:opacity-100 group-hover:pointer-events-auto sm:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="שקופית הבאה"
            className="absolute top-1/2 right-3 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 p-2.5 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 pointer-events-none hover:bg-black/80 group-hover:opacity-100 group-hover:pointer-events-auto sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`מעבר לשקופית: ${slide.eyebrow}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-lime-400 shadow-glow' : 'w-1.5 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
