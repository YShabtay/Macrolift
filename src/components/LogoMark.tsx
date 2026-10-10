/**
 * The app's logo mark: a barbell whose bar climbs like a trend line (strength and progress). Drawn in the current text colour so it works on any tile; the same
 * geometry is in scripts/generate-icons.mjs, which renders the home-screen and favicon images.
 */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="62 113 388 286" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M166 316 H206 L326 196 H346" fill="none" stroke="currentColor" strokeWidth="36" strokeLinejoin="round" />
      <rect x="130" y="241" width="36" height="150" rx="18" />
      <rect x="94" y="261" width="28" height="110" rx="14" />
      <rect x="70" y="296" width="16" height="40" rx="8" />
      <rect x="346" y="121" width="36" height="150" rx="18" />
      <rect x="390" y="141" width="28" height="110" rx="14" />
      <rect x="426" y="176" width="16" height="40" rx="8" />
    </svg>
  );
}
