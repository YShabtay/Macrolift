/**
 * The app's logo mark: a bold dumbbell. Drawn in the current text colour so it works on any tile; the same geometry is in scripts/generate-icons.mjs, which
 * renders the home-screen and favicon images.
 */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="50 50 412 412" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="161" y="238" width="190" height="36" rx="18" />
      <rect x="116" y="156" width="52" height="200" rx="20" />
      <rect x="344" y="156" width="52" height="200" rx="20" />
      <rect x="70" y="186" width="38" height="140" rx="16" />
      <rect x="404" y="186" width="38" height="140" rx="16" />
    </svg>
  );
}
