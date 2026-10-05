import { APP_PHOTO } from '../utils/appPhoto';

/**
 * The photo from the hero, blurred and fixed behind the whole app, so scrolling down turns the sharp picture into a soft backdrop. The blur is
 * baked into this single layer once - the cards on top are only translucent, which looks like glass without making every card re-blur on scroll.
 */
export default function AppBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <img src={APP_PHOTO} alt="" className="h-full w-full scale-125 object-cover object-[50%_35%] blur-3xl" />
      <div className="absolute inset-0 bg-zinc-50/90 dark:bg-zinc-950/40" />
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-lime-400/5 to-transparent" />
    </div>
  );
}
