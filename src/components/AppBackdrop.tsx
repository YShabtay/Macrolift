/**
 * The dashboard photo fixed behind the whole app: scrolling moves the content over it, so the cards read as glass floating above the picture.
 * Cropped to the sunlit windows (not the athlete) so the hero's athlete isn't repeated behind the text.
 */
export default function AppBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <img src="/images/dashboard-hero.jpg" alt="" className="h-full w-full scale-150 object-cover object-[92%_20%] blur-md" />
      <div className="absolute inset-0 bg-zinc-50/70 dark:bg-zinc-950/35" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-zinc-50/60 to-transparent dark:from-zinc-950/60" />
    </div>
  );
}
