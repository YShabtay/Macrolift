// Renders the app icons from the logo geometry below. Needs sharp, which is not a project dependency: run `npm i --no-save sharp` first, then `node scripts/generate-icons.mjs`.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const LIME = '#a3e635';
const DARK = '#09090b';

mkdirSync('public/icons', { recursive: true });

/**
 * The logo: a barbell whose bar climbs like a trend line (strength and progress). Drawn on a 512 grid and centered, inside the central 73% so it also fits the
 * safe zone of a maskable icon. The same geometry is in src/components/LogoMark.tsx.
 */
function barbell(color) {
  return `
    <path d="M166 316 H206 L326 196 H346" fill="none" stroke="${color}" stroke-width="36" stroke-linejoin="round" />
    <rect x="130" y="241" width="36" height="150" rx="18" fill="${color}" />
    <rect x="94" y="261" width="28" height="110" rx="14" fill="${color}" />
    <rect x="70" y="296" width="16" height="40" rx="8" fill="${color}" />
    <rect x="346" y="121" width="36" height="150" rx="18" fill="${color}" />
    <rect x="390" y="141" width="28" height="110" rx="14" fill="${color}" />
    <rect x="426" y="176" width="16" height="40" rx="8" fill="${color}" />
  `;
}

// "any" icon: a gently rounded dark square (the OS may mask it further).
const anySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${DARK}" />
  ${barbell(LIME)}
</svg>`;

// Full-bleed square for the maskable icon and the iOS home-screen icon (the OS rounds the corners itself).
const fullBleedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${DARK}" />
  ${barbell(LIME)}
</svg>`;

// The browser-tab icon: the same mark on a small rounded square.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${DARK}" />
  ${barbell(LIME)}
</svg>
`;
writeFileSync('public/favicon.svg', faviconSvg);
console.log('wrote public/favicon.svg');

const jobs = [
  { svg: anySvg, size: 192, out: 'public/icons/icon-192.png' },
  { svg: anySvg, size: 512, out: 'public/icons/icon-512.png' },
  { svg: fullBleedSvg, size: 192, out: 'public/icons/icon-maskable-192.png' },
  { svg: fullBleedSvg, size: 512, out: 'public/icons/icon-maskable-512.png' },
  { svg: fullBleedSvg, size: 180, out: 'public/icons/apple-touch-icon.png' },
];

for (const job of jobs) {
  await sharp(Buffer.from(job.svg)).resize(job.size, job.size).png().toFile(job.out);
  console.log('wrote', job.out);
}
